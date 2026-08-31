export const USDC_CODE = "USDC";

/** Circle's USDC on Stellar testnet. Override with STELLAR_USDC_ISSUER. */
export const DEFAULT_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export function usdcIssuer(): string {
  return process.env.STELLAR_USDC_ISSUER ?? DEFAULT_USDC_ISSUER;
}

const STROOPS_PER_UNIT = 10_000_000n;

export function stroops(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("invalid amount");
  }
  const [whole, fracRaw = ""] = trimmed.split(".");
  if (fracRaw.length > 7 && /[1-9]/.test(fracRaw.slice(7))) {
    throw new Error("amount has more than 7 decimal places");
  }
  const frac = (fracRaw + "0000000").slice(0, 7);
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(frac);
}

export function amountsEqual(a: string, b: string): boolean {
  try {
    return stroops(a) === stroops(b);
  } catch {
    return false;
  }
}

export function isUsdcCredit(input: {
  assetType: string | null;
  assetCode: string | null;
  assetIssuer: string | null;
}): boolean {
  return (
    input.assetType !== "native" &&
    input.assetCode === USDC_CODE &&
    input.assetIssuer === usdcIssuer()
  );
}
