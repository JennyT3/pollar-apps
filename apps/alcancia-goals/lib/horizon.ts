import { USDC_ISSUER_TESTNET } from "./payments";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

/** stellar.expert link for a testnet transaction hash — what "verifiable by its hash" points to in the UI. */
export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

interface HorizonOperation {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  transaction?: { successful?: boolean; memo_type?: string; memo?: string };
}

interface HorizonOperationsPage {
  _embedded: { records: HorizonOperation[] };
}

/**
 * Confirms `hash` is a real, successful testnet USDC payment to
 * `expectedDestination` for at least `expectedAmount`, memo-bound to
 * `expectedGoalId` (so a hash can't be replayed against a different goal).
 * Returns the on-chain sender — never the caller's claimed address, which is
 * public and provable by anyone — or null if any check fails, including a
 * Horizon outage: a contribution that can't be verified must be rejected,
 * not recorded unverified (see the contributions route).
 *
 * `join=transactions` embeds each operation's parent transaction so
 * `successful` and the memo can be checked in the same round trip — Horizon
 * hides failed-transaction operations by default, which is why amount/asset
 * checks alone "worked" even without this, but relying on that silently is
 * fragile.
 */
export async function verifyContributionOnTestnet(
  hash: string,
  expectedDestination: string,
  expectedAmount: string,
  expectedGoalId: string
): Promise<string | null> {
  let operations: HorizonOperation[];
  try {
    const res = await fetch(
      `${HORIZON_TESTNET}/transactions/${hash}/operations?join=transactions`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const page = (await res.json()) as HorizonOperationsPage;
    operations = page._embedded.records;
  } catch {
    return null;
  }

  const minAmount = Number(expectedAmount) - 0.0000001;
  const match = operations.find(
    (op) =>
      op.type === "payment" &&
      op.transaction?.successful === true &&
      op.to === expectedDestination &&
      op.asset_code === "USDC" &&
      op.asset_issuer === USDC_ISSUER_TESTNET &&
      Number(op.amount ?? "0") >= minAmount &&
      op.transaction?.memo_type === "text" &&
      op.transaction?.memo === expectedGoalId &&
      !!op.from
  );
  return match?.from ?? null;
}
