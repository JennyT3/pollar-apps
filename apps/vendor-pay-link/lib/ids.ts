import { customAlphabet } from "nanoid";

/** URL-safe, no ambiguous chars (0/O, 1/l). */
const nano = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

/** Public stall code in the permanent QR URL. */
export function newPublicCode(): string {
  return nano(8);
}

/** Sale / charge ids. Memo becomes `P-{id}` (≤28 Stellar text memo). */
export function newSaleId(): string {
  return nano(10);
}

export function memoForSale(saleId: string): string {
  return `P-${saleId}`;
}

export function saleIdFromMemo(memo: string): string | null {
  const m = memo.trim().match(/^P-([a-z0-9]{10})$/i);
  return m ? m[1].toLowerCase() : null;
}
