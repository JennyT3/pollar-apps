import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, pollas, syncState, type Polla } from "@/db/schema";
import { HORIZON_URL, toStroops, USDC } from "@/lib/stellar";

/**
 * Catches the entries the browser never reported.
 *
 * The normal path is the player's client handing the app the hash right after
 * paying. But phones lose signal, tabs get closed on the "sending…" screen and
 * batteries die between signing and reporting, and then the money is on the
 * ledger while the player shows as unpaid, which in a polla means being left
 * out of a pot they already paid into. So the organizer's account is swept for
 * incoming payments and matched by the memo each entry carries.
 *
 * Why Horizon and not the SDK's own history: `fetchTxHistory` returns the
 * transactions of the *logged-in* account, and a `TxHistoryRecord` carries
 * `id`, `hash`, `status`, `operation`, `summary` and an untyped `details` bag,
 * with no counterparty and no memo in the type. Even polled by the organizer it
 * would not show a payment somebody else submitted, and could not tell which
 * entry it settles. Horizon exposes exactly that, publicly and read-only, so
 * that is what the sweep reads. See README, "How entries are detected".
 *
 * Limits, all of them deliberate:
 *  - It is polling, not a webhook: an entry is detected on the next pass, not
 *    the instant it lands. The SDK has no client-side webhooks.
 *  - A pass runs when someone opens the polla or presses Actualizar. Nobody
 *    watching means nothing swept, until the next person looks.
 *  - Matching is by memo, amount, asset and destination together. A payment to
 *    the organizer without the right memo is somebody else's business and is
 *    left alone.
 */

interface HorizonPayment {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_code?: string;
  asset_issuer?: string;
  paging_token: string;
  transaction_hash?: string;
  transaction?: {
    memo?: string;
    memo_type?: string;
    ledger?: number;
    successful?: boolean;
  };
}

export interface SyncResult {
  scanned: number;
  settled: string[];
  skipped: boolean;
}

/** Floor between sweeps, so a page full of viewers doesn't hammer Horizon. */
const MIN_INTERVAL_MS = 4000;

export async function syncEntries(
  polla: Polla,
  { force = false }: { force?: boolean } = {}
): Promise<SyncResult> {
  const [state] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.pollaId, polla.id))
    .limit(1);

  const now = Date.now();
  if (!force && state && now - state.syncedAt < MIN_INTERVAL_MS) {
    return { scanned: 0, settled: [], skipped: true };
  }

  const url = new URL(`${HORIZON_URL}/accounts/${polla.organizerAddress}/payments`);
  url.searchParams.set("join", "transactions");
  url.searchParams.set("limit", "100");
  if (state?.lastCursor) {
    // Everything after what was already looked at.
    url.searchParams.set("order", "asc");
    url.searchParams.set("cursor", state.lastCursor);
  } else {
    // First pass: the newest page, so an organizer with a long history doesn't
    // drag all of it through on the first look.
    url.searchParams.set("order", "desc");
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { scanned: 0, settled: [], skipped: false };

  const body = (await res.json()) as {
    _embedded?: { records?: HorizonPayment[] };
  };
  const records = body._embedded?.records ?? [];

  const settled: string[] = [];
  let newestCursor = state?.lastCursor ?? null;

  for (const record of records) {
    if (!newestCursor || BigInt(record.paging_token) > BigInt(newestCursor)) {
      newestCursor = record.paging_token;
    }

    if (record.type !== "payment") continue;
    if (record.to !== polla.organizerAddress) continue;
    if (record.asset_code !== USDC.code || record.asset_issuer !== USDC.issuer) {
      continue;
    }
    if (record.transaction?.successful === false) continue;
    if (record.transaction?.memo_type !== "id" || !record.transaction.memo) continue;
    if (!record.transaction_hash || !record.amount) continue;

    const memoId = Number(record.transaction.memo);
    if (!Number.isSafeInteger(memoId)) continue;

    const [entry] = await db
      .select()
      .from(entries)
      .where(and(eq(entries.memoId, memoId), eq(entries.pollaId, polla.id)))
      .limit(1);

    if (!entry || entry.status !== "pending") continue;
    // The memo says which entry; the amount still has to agree, and the payer
    // has to be the player whose entry it is.
    if (toStroops(record.amount) !== toStroops(entry.amount)) continue;
    if (record.from !== entry.playerAddress) continue;

    try {
      const [updated] = await db
        .update(entries)
        .set({
          status: "paid",
          txHash: record.transaction_hash,
          ledger: record.transaction?.ledger ?? null,
          paidAt: Date.now(),
        })
        .where(and(eq(entries.id, entry.id), eq(entries.status, "pending")))
        .returning({ id: entries.id });
      if (updated) settled.push(updated.id);
    } catch {
      // UNIQUE on tx_hash: that payment already settled an entry.
    }
  }

  await db
    .insert(syncState)
    .values({ pollaId: polla.id, lastCursor: newestCursor, syncedAt: now })
    .onConflictDoUpdate({
      target: syncState.pollaId,
      set: { lastCursor: newestCursor, syncedAt: now },
    });

  return { scanned: records.length, settled, skipped: false };
}

/** Convenience for routes that only have the code. */
export async function syncByCode(code: string): Promise<SyncResult | null> {
  const [polla] = await db
    .select()
    .from(pollas)
    .where(eq(pollas.code, code))
    .limit(1);
  if (!polla) return null;
  return syncEntries(polla);
}
