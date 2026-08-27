/**
 * Local, client-only history of recent corridor transfers. Nothing here is
 * synced to a server — it exists purely so a user who navigates away (or
 * refreshes) mid-transfer can find their in-flight transfer again and check
 * its latest status, instead of losing track of it. Records older than
 * HISTORY_TTL_MS are dropped the next time the list is read or written.
 */

const STORAGE_KEY = "pollar-corridor-history-v1";
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type CorridorStatus =
  | "QUOTED"
  | "AWAITING_CRYPTO"
  | "CRYPTO_CONFIRMED"
  | "PAYOUT_PENDING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export const CORRIDOR_TERMINAL_STATUSES: readonly CorridorStatus[] = [
  "COMPLETED",
  "FAILED",
  "EXPIRED",
];

export type CorridorHistoryRecord = {
  /** Morapay bridgeTransferId, same value as the original quoteId. */
  id: string;
  createdAt: number;
  updatedAt: number;
  sourceCurrency: string;
  sourceAmount: string;
  destCurrency: string;
  destAmount: string;
  status: CorridorStatus;
  stellarTxHash?: string | null;
  momoReference?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

function readRaw(): CorridorHistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(records: CorridorHistoryRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function prune(records: CorridorHistoryRecord[]): CorridorHistoryRecord[] {
  const cutoff = Date.now() - HISTORY_TTL_MS;
  return records.filter((r) => r.createdAt >= cutoff);
}

/** Newest first, with anything older than 24h already dropped. */
export function loadHistory(): CorridorHistoryRecord[] {
  const pruned = prune(readRaw());
  writeRaw(pruned);
  return [...pruned].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Insert or update by id; bumps updatedAt to now. On an update, the
 * original createdAt always wins over whatever the caller passed — the 24h
 * TTL is measured from when the transfer started, not from its last poll.
 */
export function upsertHistory(
  record: Omit<CorridorHistoryRecord, "updatedAt"> & { updatedAt?: number },
): CorridorHistoryRecord[] {
  const now = Date.now();
  const existing = prune(readRaw());
  const idx = existing.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...record, createdAt: existing[idx].createdAt, updatedAt: now };
  } else {
    existing.unshift({ ...record, updatedAt: now });
  }
  writeRaw(existing);
  return [...existing].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function clearHistory() {
  writeRaw([]);
}
