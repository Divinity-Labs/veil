/**
 * How a wallet's fee-payer Ed25519 key was derived.
 *
 * A wallet stays pinned to the mode its address was first established with,
 * because changing the derivation changes the account that holds the fees.
 *
 * - `prf-raw`: straight from a WebAuthn PRF output. Passkey-bound, and the
 *   method the mobile app uses, so the address reproduces on any PRF-capable
 *   device.
 * - `prf-hkdf`: a PRF output run through HKDF. What the web wallet used before
 *   it matched mobile; kept only for wallets already pinned to it.
 * - `legacy`: from the WebAuthn credential ID, which is **not a secret**. Used
 *   for wallets created before PRF support and as the fallback when the
 *   authenticator has no PRF. See {@link deriveFeePayerKeypair} for the full
 *   caveat.
 */
export type FeePayerMode = 'prf-raw' | 'prf-hkdf' | 'legacy';

/**
 * Result of checking whether a candidate fee-payer account exists on-chain.
 *
 * `network-error` and `not-probed` both mean "unknown", not "absent": a
 * candidate must not be ruled out on either.
 */
export type FeePayerProbeStatus = 'exists' | 'not-found' | 'network-error' | 'not-probed';

/**
 * One candidate address considered while picking a wallet's fee payer.
 */
export type FeePayerCandidateResult = {
  /** The derivation this candidate came from. */
  mode: FeePayerMode;
  /** The derived Stellar account ("G..."). */
  publicKey: string;
  /** Whether the account was found on-chain. */
  status: FeePayerProbeStatus;
};

/**
 * A record of how the fee payer was selected, for support and debugging.
 *
 * Useful mainly to spot a downgrade: a wallet that has a PRF-capable
 * authenticator but landed on `legacy` anyway derives a different address than
 * it will on the next device.
 */
export type FeePayerDiagnostics = {
  /** When selection ran, as an ISO 8601 timestamp. */
  at: string;
  /** Whether a PRF evaluation was attempted at all. */
  prfAttempted: boolean;
  /** How the PRF attempt ended, or `null` if it was never attempted. */
  prfOutcome: 'success' | 'unavailable' | 'error' | null;
  /** Failure detail when `prfOutcome` is `'error'`. */
  prfError?: string;
  /** Whether candidates were checked against the network. */
  probed: boolean;
  /** Every candidate considered, with its probe result. */
  candidates: FeePayerCandidateResult[];
  /** The derivation the wallet settled on. */
  chosenMode: FeePayerMode;
  /** The fee-payer account the wallet will use ("G..."). */
  chosenPublicKey: string;
};

export { deriveFeePayerKeypair } from './deriveFeePayer';
