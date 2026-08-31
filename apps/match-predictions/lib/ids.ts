import { randomBytes, randomInt } from "node:crypto";

/** No 0/O and no 1/I/L: join codes get read out loud and typed by hand. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Opaque row id. */
export function newId(): string {
  return randomBytes(12).toString("base64url");
}

/** The code in the join link and the QR: /p/<code>. */
export function newPollaCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return out;
}

/**
 * The payment reference, carried as a Stellar MEMO_ID.
 *
 * Milliseconds plus three random digits: unique in practice across every
 * polla, and at ~1.8e15 it stays well under JS's exact-integer ceiling
 * (9.007e15), so the number written into the memo is the number that comes
 * back from Horizon and from SQLite, with no precision lost in the round trip.
 * The unique indexes on `entries.memo_id` and `payouts.memo_id` make a
 * collision a failed insert rather than a mismatched payment.
 */
export function newMemoId(): number {
  return Date.now() * 1000 + randomInt(1000);
}
