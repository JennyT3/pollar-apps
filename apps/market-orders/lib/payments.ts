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
 * The asset a payment should use: the app's primary asset from useBalance(),
 * falling back to native XLM while the balance hasn't loaded yet.
 */
export function paymentAssetFrom(
  record: WalletBalanceRecord | null
): PaymentAsset {
  if (
    record &&
    (record.type === "credit_alphanum4" || record.type === "credit_alphanum12") &&
    record.issuer
  ) {
    return { type: record.type, code: record.code, issuer: record.issuer };
  }
  return { type: "native" };
}

/**
 * The payment asset for THIS app: USDC, and only USDC.
 *
 * The order flow, the day summary and the on-chain verification are all
 * USDC-denominated. Never fall back to another enabled asset or to native
 * XLM: if the wallet reports no USDC balance the caller gets `null` and must
 * tell the user USDC isn't available instead of paying in anything else.
 * The server re-checks the issuer on Horizon when verifying the payment.
 */
export function usdcPaymentAsset(
  records: WalletBalanceRecord[]
): PaymentAsset | null {
  const enabled = records.filter(
    (b) =>
      b.enabledInApp &&
      (b.type === "credit_alphanum4" || b.type === "credit_alphanum12") &&
      b.issuer
  );
  const usdc = enabled.find((b) => b.code === "USDC");
  return usdc ? paymentAssetFrom(usdc) : null;
}

export function currencyOf(asset: PaymentAsset): string {
  return asset.type === "native" ? "XLM" : asset.code;
}

/** Loose G-address sanity check; the server does the real validation. */
export function looksLikeAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}