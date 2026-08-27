/**
 * The pot, and how it is divided.
 *
 * Everything here is integer stroop arithmetic. A pot of 10 USDC split three
 * ways is 3.3333333 each with one stroop left over: that stroop belongs to
 * somebody, and the rule for who gets it has to be fixed in advance and
 * visible, or the app quietly loses money it is holding for the group.
 */

import { fromStroops, toStroops } from "@/lib/stellar";

/** What the winner of a settled polla is owed. */
export interface Share {
  address: string;
  /** Decimal string, ready for `runTx('payment', …)`. */
  amount: string;
}

/** Pot = one entry amount per paid entry. Nothing else ever enters it. */
export function potStroops(entryAmount: string, paidEntries: number): bigint {
  if (!Number.isInteger(paidEntries) || paidEntries < 0) {
    throw new RangeError(`Not a number of entries: ${paidEntries}`);
  }
  return toStroops(entryAmount) * BigInt(paidEntries);
}

export function potAmount(entryAmount: string, paidEntries: number): string {
  return fromStroops(potStroops(entryAmount, paidEntries));
}

/**
 * Splits the pot between tied winners, to the stroop.
 *
 * Equal shares, and the remainder (always fewer stroops than there are
 * winners, so at most 0.0000001 USDC each) goes one stroop at a time to the
 * winners in ascending address order. Address order is arbitrary but fixed and
 * public, which is the point: the same tie always splits the same way, and the
 * shares always add back up to exactly the pot.
 */
export function splitPot(pot: bigint, winners: readonly string[]): Share[] {
  if (winners.length === 0) return [];
  if (pot < 0n) throw new RangeError("A pot cannot be negative");

  const ordered = [...winners].sort();
  const count = BigInt(ordered.length);
  const base = pot / count;
  const remainder = pot % count;

  return ordered.map((address, index) => ({
    address,
    amount: fromStroops(base + (BigInt(index) < remainder ? 1n : 0n)),
  }));
}

/** Entry amounts a group can actually set, in whole USDC-cents of precision. */
export const ENTRY_LIMITS = { min: "0.01", max: "10000" } as const;

export function entryAmountIsValid(value: string): boolean {
  if (!/^\d+(\.\d{1,7})?$/.test(value.trim())) return false;
  const stroops = toStroops(value);
  return (
    stroops >= toStroops(ENTRY_LIMITS.min) && stroops <= toStroops(ENTRY_LIMITS.max)
  );
}
