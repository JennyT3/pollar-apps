const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

interface HorizonOperation {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_code?: string;
  asset_issuer?: string;
  transaction?: { successful?: boolean };
}

/**
 * Confirms `hash` is a real, successful testnet payment matching `expected`,
 * straight from Stellar's public Horizon API — no Pollar key involved. Used
 * so a participant can't mark their share paid by POSTing an arbitrary hash.
 *
 * Checks `from` too, not just `to`/asset/amount: without it, anyone could
 * take a *real* hash belonging to a different payment (any payment to the
 * same collector, in the same asset, for enough) and claim it under a
 * different `payerAddress` than whoever actually sent it.
 *
 * `join=transactions` embeds each operation's parent transaction so
 * `successful` can be checked explicitly, in the same round trip — Horizon
 * hides failed-transaction operations by default, which is why this worked
 * even without the check, but relying on that silently is fragile.
 */
export async function verifyPayment(
  hash: string,
  expected: {
    from: string;
    to: string;
    assetCode: string;
    assetIssuer: string;
    minAmount: string;
  }
): Promise<boolean> {
  let operations: HorizonOperation[];
  try {
    const res = await fetch(
      `${HORIZON_TESTNET}/transactions/${hash}/operations?join=transactions`
    );
    if (!res.ok) return false;
    const data = await res.json();
    operations = data._embedded?.records ?? [];
  } catch {
    return false;
  }

  return operations.some(
    (op) =>
      op.type === "payment" &&
      op.transaction?.successful === true &&
      op.from === expected.from &&
      op.to === expected.to &&
      op.asset_code === expected.assetCode &&
      op.asset_issuer === expected.assetIssuer &&
      Number(op.amount) >= Number(expected.minAmount)
  );
}
