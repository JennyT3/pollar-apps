import type { SubmitOutcome, WalletBalanceRecord } from "@pollar/core";

export type PaymentAsset =
  | { type: "native" }
  | { type: "credit_alphanum4" | "credit_alphanum12"; code: string; issuer: string };

export type PaymentResult = Extract<
  SubmitOutcome,
  { status: "success" | "pending" }
>;

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

export function usdcPaymentAsset(
  records: WalletBalanceRecord[]
): PaymentAsset {
  const enabled = records.filter(
    (b) =>
      b.enabledInApp &&
      (b.type === "credit_alphanum4" || b.type === "credit_alphanum12") &&
      b.issuer
  );
  const usdc = enabled.find((b) => b.code === "USDC");
  return paymentAssetFrom(usdc ?? enabled[0] ?? null);
}

export function currencyOf(asset: PaymentAsset): string {
  return asset.type === "native" ? "XLM" : asset.code;
}
