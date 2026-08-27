import { expect } from "@playwright/test";

export const A = "G" + "A".repeat(55);
export const B = "G" + "B".repeat(55);
export const C = "G" + "C".repeat(55);
export const USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const HORIZON = "http://127.0.0.1:9876";

export async function setHorizon(
  hash: string,
  input: {
    from: string;
    to: string;
    amount: string;
    memo: string | null;
    assetType?: string;
    assetCode?: string;
    assetIssuer?: string | null;
    opType?: string;
  }
) {
  const op = {
    type: input.opType ?? "payment",
    from: input.from,
    to: input.to,
    amount: input.amount,
    asset_type: input.assetType ?? "credit_alphanum4",
    asset_code: input.assetCode ?? "USDC",
    asset_issuer: input.assetIssuer ?? USDC_ISSUER,
  };
  const res = await fetch(`${HORIZON}/__set`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash,
      successful: true,
      memo: input.memo,
      memoType: input.memo ? "id" : null,
      ops: [op],
    }),
  });
  expect(res.ok).toBeTruthy();
}
