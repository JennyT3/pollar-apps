const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

interface HorizonOperation {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_code?: string;
  asset_issuer?: string;
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
    const res = await fetch(`${HORIZON_TESTNET}/transactions/${hash}/operations`);
    if (!res.ok) return false;
    const data = await res.json();
    operations = data._embedded?.records ?? [];
  } catch {
    return false;
  }

  return operations.some(
    (op) =>
      op.type === "payment" &&
      op.from === expected.from &&
      op.to === expected.to &&
      op.asset_code === expected.assetCode &&
      op.asset_issuer === expected.assetIssuer &&
      Number(op.amount) >= Number(expected.minAmount)
  );
}
