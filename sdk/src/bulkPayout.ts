import { StrKey } from '@stellar/stellar-sdk';

/**
 * One payment parsed out of a payout CSV.
 *
 * Amounts stay as strings so the value the caller typed reaches the network
 * unrounded; parsing to a number is only done to validate it.
 */
export type PayoutRow = {
    /** Destination Stellar account, an Ed25519 public key ("G..."). */
    recipient: string;
    /** Decimal amount to send, as written in the CSV. Must parse above zero. */
    amount: string;
    /** Asset code to send, e.g. "XLM" or "USDC". Never empty. */
    asset: string;
};

/**
 * A single problem found while parsing a CSV row.
 *
 * One row can produce several of these, one per bad field.
 */
export type ValidationError = {
    /**
     * 1-based line number in the CSV the problem was found on, counting the
     * header as line 0. Note this is a line number, not an index into
     * {@link ParseResult.rows}, which excludes rejected rows.
     */
    row: number;
    /** Which column failed: "recipient", "amount", "asset", or "header". */
    field: string;
    /** Human-readable description of what was wrong. */
    error: string;
};

/**
 * The outcome of {@link parseCSV}: the rows that passed validation and every
 * problem found. A file can yield both, so check `errors` even when `rows` is
 * non-empty.
 */
export type ParseResult = {
    /** Rows that passed every check. Rows with any error are omitted. */
    rows: PayoutRow[];
    /** Every validation failure found, in the order encountered. */
    errors: ValidationError[];
};

/**
 * Resumable progress for one payout run, persisted between page loads so a
 * batch interrupted partway can be picked up without paying anyone twice.
 */
export type BatchState = {
    /** Unique id for this run, and the key the state is stored under. */
    batchId: string;
    /** How many rows the run started with. */
    totalRows: number;
    /** Indices into the caller's `rows` array that have been paid. */
    completedRows: number[];
    /** Row index to the hash of the transaction that settled it. */
    txHashes: Record<number, string>;
    /** When the run began, as epoch milliseconds. */
    startedAt: number;
};

/**
 * The final tally from {@link executePayout}.
 *
 * `completedRows` and `failedRows` together cover every row that was still
 * outstanding when the run started; rows already marked complete in a resumed
 * {@link BatchState} stay in `completedRows`.
 */
export type PayoutResult = {
    /** The run's id, matching the {@link BatchState} it was driven from. */
    batchId: string;
    /** Row index to the hash of the transaction that settled it. */
    txHashes: Record<number, string>;
    /** Indices of rows that were paid. */
    completedRows: number[];
    /** Indices of rows whose batch threw. These were not paid. */
    failedRows: number[];
};

/**
 * Parse and validate a payout CSV.
 *
 * The header must contain `recipient`, `amount` and `asset` columns; matching
 * is case-insensitive and order does not matter. Blank lines are skipped. A row
 * is kept only if all three fields pass, so a returned row is always safe to
 * submit.
 *
 * Fields are split on commas with no quoting support, so an asset code or
 * address containing a comma is not handled.
 *
 * @param csvText Raw CSV text, with either LF or CRLF line endings.
 * @returns The accepted rows and every validation error found.
 */
export function parseCSV(csvText: string): ParseResult {
    const lines = csvText.split(/\r?\n/);
    const rows: PayoutRow[] = [];
    const errors: ValidationError[] = [];

    if (lines.length === 0) return { rows, errors };

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const recipientIdx = header.indexOf('recipient');
    const amountIdx = header.indexOf('amount');
    const assetIdx = header.indexOf('asset');

    if (recipientIdx === -1 || amountIdx === -1 || assetIdx === -1) {
        errors.push({ row: 0, field: 'header', error: 'Missing required columns: recipient, amount, asset' });
        return { rows, errors };
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(c => c.trim());
        const recipient = cols[recipientIdx] ?? '';
        const amount = cols[amountIdx] ?? '';
        const asset = cols[assetIdx] ?? '';
        const rowIndex = i;
        let rowHasError = false;

        if (!StrKey.isValidEd25519PublicKey(recipient)) {
            errors.push({ row: rowIndex, field: 'recipient', error: `Invalid Stellar address: ${recipient}` });
            rowHasError = true;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            errors.push({ row: rowIndex, field: 'amount', error: `Invalid amount: ${amount}` });
            rowHasError = true;
        }

        if (!asset) {
            errors.push({ row: rowIndex, field: 'asset', error: 'Asset cannot be empty' });
            rowHasError = true;
        }

        if (!rowHasError) {
            rows.push({ recipient, amount, asset });
        }
    }

    return { rows, errors };
}

/**
 * Split rows into fixed-size chunks for submission.
 *
 * @param rows Rows to chunk, in order.
 * @param batchSize Maximum rows per chunk. Defaults to 100.
 * @returns The chunks, preserving input order. Empty when `rows` is empty.
 */
export function createBatches(rows: PayoutRow[], batchSize = 100): PayoutRow[][] {
    const batches: PayoutRow[][] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
        batches.push(rows.slice(i, i + batchSize));
    }
    return batches;
}

/**
 * Start tracking a new payout run.
 *
 * The id comes from `crypto.randomUUID()` where available, falling back to a
 * base-36 timestamp, so it is unique per run but not a security token.
 *
 * @param rows The rows the run will pay.
 * @returns Fresh state with nothing yet completed. Not persisted; pass it to
 * {@link saveBatchState} to store it.
 */
export function initBatchState(rows: PayoutRow[]): BatchState {
    const batchId =
        typeof crypto !== 'undefined' && typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function'
            ? (crypto as { randomUUID: () => string }).randomUUID()
            : Date.now().toString(36);
    return {
        batchId,
        totalRows: rows.length,
        completedRows: [],
        txHashes: {},
        startedAt: Date.now(),
    };
}

const stateKey = (batchId: string) => `veil_bulk_payout_${batchId}`;

/**
 * Persist a run's progress to `localStorage` under its batch id.
 *
 * Browser only: throws where `localStorage` is unavailable.
 *
 * @param state The state to store, overwriting any state under the same id.
 */
export function saveBatchState(state: BatchState): void {
    localStorage.setItem(stateKey(state.batchId), JSON.stringify(state));
}

/**
 * Read back a run's progress so it can be resumed.
 *
 * @param batchId The id of the run to load.
 * @returns The stored state, or `null` if nothing is stored under that id or
 * the stored value is not valid JSON.
 */
export function loadBatchState(batchId: string): BatchState | null {
    const item = localStorage.getItem(stateKey(batchId));
    if (!item) return null;
    try {
        return JSON.parse(item) as BatchState;
    } catch {
        return null;
    }
}

/**
 * Delete a run's stored progress, once it has finished and the result is
 * recorded elsewhere.
 *
 * @param batchId The id of the run to forget.
 */
export function clearBatchState(batchId: string): void {
    localStorage.removeItem(stateKey(batchId));
}

/**
 * Run a payout to completion, batch by batch, and record what settled.
 *
 * Rows already listed in `state.completedRows` are skipped, which is what makes
 * a run resumable: pass the state from {@link loadBatchState} and only the
 * outstanding rows are submitted. Progress is saved after each successful
 * batch.
 *
 * A batch that throws is recorded in `failedRows` and the run continues with
 * the next batch, so this rejects only if `submitBatch` fails in a way that
 * escapes it. The caller's `state` is not mutated.
 *
 * @param rows Every row in the run, including ones already paid.
 * @param state Progress to resume from, from {@link initBatchState} or
 * {@link loadBatchState}.
 * @param submitBatch Submits one batch and resolves with the transaction hash
 * and the row indices it covered. Rejecting marks those rows failed.
 * @param onProgress Called with the updated state after each successful batch.
 * @param batchSize Maximum rows per transaction. Defaults to 100, and must
 * match the size used to build `state` for indices to line up.
 * @returns Which rows were paid, which failed, and the hash for each payment.
 */
export async function executePayout(
    rows: PayoutRow[],
    state: BatchState,
    submitBatch: (
        batch: PayoutRow[],
        rowIndices: number[]
    ) => Promise<{ txHash: string; rowIndices: number[] }>,
    onProgress?: (state: BatchState) => void,
    batchSize = 100
): Promise<PayoutResult> {
    const completedSet = new Set(state.completedRows);
    const failedRows: number[] = [];
    const current: BatchState = { ...state, completedRows: [...state.completedRows], txHashes: { ...state.txHashes } };

    const batches = createBatches(rows, batchSize);
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const baseOffset = batchIdx * batchSize;
        const batchRows: PayoutRow[] = [];
        const batchIndices: number[] = [];

        for (let j = 0; j < batch.length; j++) {
            const globalIdx = baseOffset + j;
            if (!completedSet.has(globalIdx)) {
                batchRows.push(batch[j]);
                batchIndices.push(globalIdx);
            }
        }

        if (batchRows.length === 0) continue;

        try {
            const result = await submitBatch(batchRows, batchIndices);
            for (const idx of result.rowIndices) {
                completedSet.add(idx);
                current.completedRows.push(idx);
                current.txHashes[idx] = result.txHash;
            }
            saveBatchState(current);
            onProgress?.(current);
        } catch {
            for (const idx of batchIndices) {
                failedRows.push(idx);
            }
        }
    }

    return {
        batchId: current.batchId,
        txHashes: current.txHashes,
        completedRows: current.completedRows,
        failedRows,
    };
}
