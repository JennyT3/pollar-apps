/**
 * Shared request/response shapes for Morapay's merchant Bridge API
 * (pesos <-> GHS via Stellar USDC). Framework-agnostic — safe to import from
 * both server code (lib/morapay/client.ts) and browser code that only talks
 * to your own proxy, never to Morapay directly.
 */

export type BridgeDirection = "PESOS_TO_GHS" | "GHS_TO_PESOS";

export type MorapayEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type BridgeQuote = {
  quoteId: string;
  expiresAt: string;
  direction: BridgeDirection;
  source: { currency: string; amount: string };
  destination: { currency: string; amount: string };
  bridge: { chain: string; asset: string; amount: string; tokenAddress: string };
};

export type MomoRecipient = {
  phone: string;
  receiverName: string;
  providerHint?: string;
};

/**
 * A Stellar payment instruction — either the whole `execute` response (legacy
 * shape, `partnerAction: "SEND_STELLAR_USDC"`) or nested under
 * `payment.stellarFallback` when Morapay hosts the fiat QR itself but the
 * caller wants a fallback in case that path isn't available.
 */
export type BridgeStellarPayment = {
  kind?: "stellar_payment";
  destination: string;
  amount: string;
  assetType?: string;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string | null;
};

/** A QR/payment-code Morapay generated and hosts itself (image or opaque payload). */
export type BridgeScannable = {
  kind?: string;
  payload?: string | null;
  payloadLabel?: string | null;
  image?: { mediaType?: string; encoding?: string; data?: string; inlineSafe?: boolean };
};

/**
 * `partnerAction: "PAY_LOCAL_FIAT"` shape — Morapay ran its own Pollar
 * onramp session and hosts the local-rail (QR) payment itself.
 * `stellarFallback` is present for wallets that already hold USDC and want
 * to skip the fiat leg entirely.
 */
export type BridgeFiatRailDeposit = {
  kind: "fiat_rail_deposit";
  rail: string;
  country: string;
  currency: string;
  amount: string;
  providerTxId?: string;
  scannable?: BridgeScannable;
  stellarFallback?: BridgeStellarPayment;
};

export type BridgePayment = BridgeFiatRailDeposit | BridgeStellarPayment;

export function isFiatRailDeposit(p: BridgePayment | undefined): p is BridgeFiatRailDeposit {
  return !!p && (p as BridgeFiatRailDeposit).kind === "fiat_rail_deposit";
}

export function stellarPaymentOf(p: BridgePayment | undefined): BridgeStellarPayment | undefined {
  if (!p) return undefined;
  if (isFiatRailDeposit(p)) return p.stellarFallback;
  if ("destination" in p) return p;
  return undefined;
}

export type BridgeExecuteResult = {
  bridgeTransferId: string;
  direction: BridgeDirection;
  status: string;
  partnerAction?: "PAY_LOCAL_FIAT" | "SEND_STELLAR_USDC" | "COMPLETE_LOCAL_PAYOUT";
  payment?: BridgePayment;
};

export type BridgeResult = {
  id?: string;
  direction?: BridgeDirection;
  status: string;
  source: { currency: string; amount: string };
  destination: { currency: string; amount: string };
  bridge?: { chain: string; asset: string; amount: string; tokenAddress: string };
  stellarTxHash?: string | null;
  momoReference?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const PESOS_CURRENCIES = ["BOB", "MXN", "ARS", "CLP", "COP", "PHP", "UYU", "DOP"] as const;

export const BRIDGE_TERMINAL_STATUSES: readonly string[] = ["COMPLETED", "FAILED", "EXPIRED"];

/** Thrown by callMorapay — carries Morapay's `code` (e.g. "QUOTE_EXPIRED") so callers can branch on it, not just the message. */
export class MorapayApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "MorapayApiError";
    this.code = code;
  }
}

/**
 * Ghanaians write and dial local numbers as 0XXXXXXXXX; Morapay's API wants
 * the international form (233XXXXXXXXX, no leading 0, no +). Accept whatever
 * the user types (0..., +233..., 233...) and normalize before it ever leaves
 * the browser.
 */
export function toGhanaInternationalPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return `233${digits.slice(1)}`;
  return digits;
}

// Stellar memos are typed (text vs numeric id) — Morapay's docs only show
// `memo: "…"` as a placeholder, so this is a best-effort guess until a real
// value is confirmed: pure digits -> MEMO_ID, anything else -> MEMO_TEXT
// (28-byte cap). Flip this if a live execute response proves it wrong.
export function inferStellarMemo(
  memo: string | null | undefined,
): { type: "id" | "text"; value: string } | undefined {
  if (!memo) return undefined;
  return /^[0-9]+$/.test(memo) ? { type: "id", value: memo } : { type: "text", value: memo.slice(0, 28) };
}
