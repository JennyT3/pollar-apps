import type { SubmitOutcome, WalletBalanceRecord } from "@pollar/core";

/** Asset for `runTx('payment', …)`. */
export type PaymentAsset =
  | { type: "native" }
  | { type: "credit_alphanum4" | "credit_alphanum12"; code: string; issuer: string };

export type PaymentResult = Extract<
  SubmitOutcome,
  { status: "success" | "pending" }
>;

/**
 * The asset a payment should use: USDC from useBalance().
 * Returns null until that balance is loaded (never falls back to native XLM).
 */
export function paymentAssetFrom(
  record: WalletBalanceRecord | null
): PaymentAsset | null {
  if (
    record &&
    (record.type === "credit_alphanum4" || record.type === "credit_alphanum12") &&
    record.code === "USDC" &&
    record.issuer
  ) {
    return { type: record.type, code: record.code, issuer: record.issuer };
  }
  return null;
}

export function currencyOf(asset: PaymentAsset | null): string {
  if (!asset) return "USDC";
  if (asset.type === "native") return "XLM";
  return asset.code;
}

/** Loose G-address sanity check; the server does the real validation. */
export function looksLikeAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}
