const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

/** stellar.expert link for a testnet transaction hash — what "verifiable by its hash" points to in the UI. */
export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

interface HorizonOperation {
  type: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
}

interface HorizonOperationsPage {
  _embedded: { records: HorizonOperation[] };
}

/**
 * Confirms a contribution's tx hash is a real, already-settled Stellar
 * testnet payment operation to `expectedDestination` for at least
 * `expectedAmount`. Best-effort: a Horizon outage shouldn't block a
 * contribution the SDK already confirmed, so callers treat a thrown error as
 * "could not verify" rather than "invalid" and still record it, unverified.
 */
export async function verifyPaymentOnTestnet(
  hash: string,
  expectedDestination: string,
  expectedAmount: string
): Promise<boolean> {
  const res = await fetch(`${HORIZON_TESTNET}/transactions/${hash}/operations`, {
    cache: "no-store",
  });
  if (!res.ok) return false;
  const page = (await res.json()) as HorizonOperationsPage;
  const minAmount = Number(expectedAmount) - 0.0000001;
  return page._embedded.records.some(
    (op) =>
      op.type === "payment" &&
      op.to === expectedDestination &&
      Number(op.amount ?? "0") >= minAmount
  );
}
