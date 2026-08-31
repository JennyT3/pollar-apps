import type { PaymentAsset } from "@/lib/payments";

/**
 * Every split settles in this asset, always — not whatever the collector's
 * wallet happens to hold at creation time (their balance is irrelevant:
 * they don't pay anything to create a split, only participants do).
 */
export const TESTNET_USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
} as const;

export interface Split {
  id: string;
  shortRef: string;
  description: string;
  totalAmount: string;
  assetCode: string;
  assetIssuer: string;
  collectorAddress: string;
  status: "open" | "closed";
  createdAt: string;
  participants: SplitParticipant[];
}

export interface SplitParticipant {
  id: string;
  splitId: string;
  label: string;
  shareAmount: string;
  payerAddress: string | null;
  txHash: string | null;
  paidAt: string | null;
}

/** Reconstructs the SDK's `PaymentAsset` shape from a split's stored asset fields. */
export function assetFromSplit(split: Pick<Split, "assetCode" | "assetIssuer">): PaymentAsset {
  if (split.assetIssuer === "native") return { type: "native" };
  return {
    type: split.assetCode.length > 4 ? "credit_alphanum12" : "credit_alphanum4",
    code: split.assetCode,
    issuer: split.assetIssuer,
  };
}

/**
 * Splits `total` into `count` equal decimal strings (2 decimal places) that
 * sum back to exactly `total` — the remainder cent(s) land on the last share.
 */
export function computeEqualShares(total: string, count: number): string[] {
  const totalCents = Math.round(Number(total) * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  return Array.from({ length: count }, (_, i) => {
    const cents = baseCents + (i === count - 1 ? remainder : 0);
    return (cents / 100).toFixed(2);
  });
}
