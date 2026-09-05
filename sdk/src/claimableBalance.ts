import {
    Keypair,
    TransactionBuilder,
    BASE_FEE,
    Operation,
    Asset,
    Claimant,
    Horizon,
} from '@stellar/stellar-sdk';

/**
 * Network settings shared by every escrow call in this module.
 *
 * These operations are classic Stellar, not Soroban, so they go through Horizon
 * rather than the RPC endpoint the rest of the SDK uses.
 */
export type EscrowConfig = {
    /** Stellar Horizon REST API base URL (e.g. "https://horizon-testnet.stellar.org").
     *  Must be a Horizon URL — NOT a Soroban RPC endpoint. */
    horizonUrl: string;
    /** Stellar network passphrase. Use Networks.TESTNET or Networks.PUBLIC. */
    networkPassphrase: string;
};

/**
 * Arguments for {@link createEscrow}.
 */
export type CreateEscrowOptions = {
    /** Funds the escrow and signs the transaction. Also the reclaim party. */
    senderKeypair: Keypair;
    /** Account allowed to claim, an Ed25519 public key ("G..."). */
    recipientAddress: string;
    /** Amount to lock up, as a decimal string. */
    amount: string;
    /** Asset to lock up. */
    asset: Asset;
    /** Duration in seconds from now before the sender can reclaim the balance. */
    claimDeadlineSeconds: number;
    /** Horizon endpoint and network to build against. */
    config: EscrowConfig;
};

/**
 * What {@link createEscrow} produced.
 */
export type EscrowResult = {
    /** Stellar claimable balance id, needed to claim or reclaim. */
    balanceId: string;
    /** Shareable claim URL from {@link buildClaimLink}. */
    claimLink: string;
    /** When the sender may reclaim, as a Unix timestamp in seconds. */
    expiresAt: number;
};

/**
 * Arguments for {@link claimEscrow}.
 */
export type ClaimOptions = {
    /** The recipient named when the escrow was created. Signs the claim. */
    claimantKeypair: Keypair;
    /** The balance to claim, from {@link EscrowResult.balanceId}. */
    balanceId: string;
    /** Horizon endpoint and network to build against. */
    config: EscrowConfig;
};

/**
 * Arguments for {@link reclaimEscrow}.
 */
export type ReclaimOptions = {
    /** The account that created the escrow. Signs the reclaim. */
    senderKeypair: Keypair;
    /** The balance to reclaim, from {@link EscrowResult.balanceId}. */
    balanceId: string;
    /** Horizon endpoint and network to build against. */
    config: EscrowConfig;
};

/**
 * Build the shareable claim URL for an escrow balance.
 *
 * The host is fixed to the hosted Veil wallet and is not configurable, so a
 * self-hosted deployment should construct its own link from the balance id.
 *
 * @param balanceId The claimable balance id.
 * @returns An absolute claim URL.
 */
export function buildClaimLink(balanceId: string): string {
    return `https://app.veil.xyz/claim/${balanceId}`;
}

/**
 * Build the two Stellar Claimant entries for an escrow balance:
 *  - recipient: may claim unconditionally at any time.
 *  - sender: may reclaim ONLY after `deadlineUnix` (unix timestamp).
 *
 * A Stellar claimable balance is consumed by the first successful claim.
 * Once either party claims, the balance is gone — the other party's subsequent
 * claim will be rejected by the Stellar network. Design UIs accordingly.
 */
export function buildEscrowClaimants(
    recipientAddress: string,
    senderAddress: string,
    deadlineUnix: number
): Claimant[] {
    const recipientClaimant = new Claimant(recipientAddress, Claimant.predicateUnconditional());
    const senderClaimant = new Claimant(
        senderAddress,
        Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(deadlineUnix.toString()))
    );
    return [recipientClaimant, senderClaimant];
}

/**
 * Create a Stellar claimable balance escrow.
 *
 * The recipient may claim immediately (unconditional predicate).
 * The sender may reclaim after `claimDeadlineSeconds` has elapsed.
 * Claim and reclaim are mutually exclusive — the first successful claim
 * consumes the balance.
 *
 * @throws If Horizon does not return a balance_id in its response.
 */
export async function createEscrow(options: CreateEscrowOptions): Promise<EscrowResult> {
    const { senderKeypair, recipientAddress, amount, asset, claimDeadlineSeconds, config } = options;
    const server = new Horizon.Server(config.horizonUrl);

    const account = await server.loadAccount(senderKeypair.publicKey());
    const expiresAt = Math.floor(Date.now() / 1000) + claimDeadlineSeconds;

    const claimants = buildEscrowClaimants(recipientAddress, senderKeypair.publicKey(), expiresAt);

    const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: config.networkPassphrase,
    })
        .addOperation(
            Operation.createClaimableBalance({
                asset,
                amount,
                claimants,
            })
        )
        .setTimeout(180)
        .build();

    tx.sign(senderKeypair);

    const result = await server.submitTransaction(tx);
    const balanceId = (result as unknown as { balance_id?: string }).balance_id;
    if (!balanceId) {
        throw new Error('create_claimable_balance: missing balance_id in Horizon response');
    }

    return {
        balanceId,
        claimLink: buildClaimLink(balanceId),
        expiresAt,
    };
}

/**
 * Claim a claimable balance as the recipient.
 *
 * Once claimed the balance is consumed. A subsequent reclaimEscrow() call
 * by the sender will be rejected by the Stellar network.
 */
export async function claimEscrow(options: ClaimOptions): Promise<{ txHash: string }> {
    const { claimantKeypair, balanceId, config } = options;
    const server = new Horizon.Server(config.horizonUrl);

    const account = await server.loadAccount(claimantKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: config.networkPassphrase,
    })
        .addOperation(Operation.claimClaimableBalance({ balanceId }))
        .setTimeout(180)
        .build();

    tx.sign(claimantKeypair);

    const result = await server.submitTransaction(tx);
    return { txHash: result.hash };
}

/**
 * Reclaim a claimable balance as the sender after the deadline has passed.
 *
 * Will be rejected by the Stellar network if called before `expiresAt` or
 * if the recipient has already claimed the balance.
 */
export async function reclaimEscrow(options: ReclaimOptions): Promise<{ txHash: string }> {
    const { senderKeypair, balanceId, config } = options;
    const server = new Horizon.Server(config.horizonUrl);

    const account = await server.loadAccount(senderKeypair.publicKey());

    const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: config.networkPassphrase,
    })
        .addOperation(Operation.claimClaimableBalance({ balanceId }))
        .setTimeout(180)
        .build();

    tx.sign(senderKeypair);

    const result = await server.submitTransaction(tx);
    return { txHash: result.hash };
}
