import { describe, expect, it } from "vitest";
import {
  entryAmountIsValid,
  potAmount,
  potStroops,
  splitPot,
} from "@/lib/money";
import { toStroops } from "@/lib/stellar";

/**
 * The pot, and the stroop that has to belong to somebody.
 *
 * A tie is the one case where the app has to divide money rather than move it,
 * and floating point would be the wrong tool: 10 USDC between three winners is
 * 3.3333333 each with one stroop over. What these tests hold in place is that
 * the shares always add back up to exactly the pot, and that the same tie
 * always splits the same way.
 */

const ANA = "GA_ANA";
const BETO = "GB_BETO";
const CARO = "GC_CARO";

const sum = (amounts: string[]) =>
  amounts.reduce((total, amount) => total + toStroops(amount), 0n);

describe("potStroops / potAmount", () => {
  it("is one entry amount per paid entry, and nothing else", () => {
    expect(potStroops("5", 3)).toBe(150_000_000n);
    expect(potAmount("5", 3)).toBe("15.0000000");
  });

  it("is empty before anyone has paid", () => {
    expect(potStroops("5", 0)).toBe(0n);
    expect(potAmount("5", 0)).toBe("0.0000000");
  });

  it("keeps the precision of an entry that is not a whole number", () => {
    expect(potAmount("0.3333333", 3)).toBe("0.9999999");
  });

  it("refuses a count that is not a whole number of entries", () => {
    expect(() => potStroops("5", -1)).toThrow(RangeError);
    expect(() => potStroops("5", 1.5)).toThrow(RangeError);
  });
});

describe("splitPot", () => {
  it("divides evenly when the pot divides evenly", () => {
    const shares = splitPot(toStroops("15"), [ANA, BETO, CARO]);
    expect(shares).toEqual([
      { address: ANA, amount: "5.0000000" },
      { address: BETO, amount: "5.0000000" },
      { address: CARO, amount: "5.0000000" },
    ]);
  });

  it("hands the leftover stroops out one at a time, in address order", () => {
    // 10 USDC three ways is 3.3333333 each with one stroop left over.
    const shares = splitPot(toStroops("10"), [CARO, ANA, BETO]);
    expect(shares).toEqual([
      { address: ANA, amount: "3.3333334" },
      { address: BETO, amount: "3.3333333" },
      { address: CARO, amount: "3.3333333" },
    ]);
  });

  it("never loses or invents a stroop, whatever the pot", () => {
    for (const pot of ["10", "15", "0.0000001", "0.0000002", "7.7777777", "1"]) {
      for (const winners of [[ANA], [ANA, BETO], [ANA, BETO, CARO]]) {
        const shares = splitPot(toStroops(pot), winners);
        expect(sum(shares.map((share) => share.amount))).toBe(toStroops(pot));
      }
    }
  });

  it("splits the same way no matter what order the winners arrive in", () => {
    const pot = toStroops("10");
    expect(splitPot(pot, [ANA, BETO, CARO])).toEqual(
      splitPot(pot, [CARO, BETO, ANA])
    );
  });

  it("gives a single winner the whole pot", () => {
    expect(splitPot(toStroops("15"), [ANA])).toEqual([
      { address: ANA, amount: "15.0000000" },
    ]);
  });

  it("gives a pot smaller than the number of winners to whoever it reaches", () => {
    // Two stroops, three winners: the last one is owed nothing at all.
    expect(splitPot(2n, [ANA, BETO, CARO])).toEqual([
      { address: ANA, amount: "0.0000001" },
      { address: BETO, amount: "0.0000001" },
      { address: CARO, amount: "0.0000000" },
    ]);
  });

  it("pays nobody when there is nobody to pay", () => {
    expect(splitPot(toStroops("15"), [])).toEqual([]);
  });

  it("refuses a negative pot", () => {
    expect(() => splitPot(-1n, [ANA])).toThrow(RangeError);
  });
});

describe("entryAmountIsValid", () => {
  it("accepts amounts inside the declared limits", () => {
    expect(entryAmountIsValid("5")).toBe(true);
    expect(entryAmountIsValid("0.01")).toBe(true);
    expect(entryAmountIsValid("10000")).toBe(true);
    expect(entryAmountIsValid(" 12.50 ")).toBe(true);
  });

  it("refuses amounts outside them", () => {
    expect(entryAmountIsValid("0")).toBe(false);
    expect(entryAmountIsValid("0.009")).toBe(false);
    expect(entryAmountIsValid("10000.0000001")).toBe(false);
  });

  it("refuses anything that is not a Stellar amount", () => {
    expect(entryAmountIsValid("")).toBe(false);
    expect(entryAmountIsValid("abc")).toBe(false);
    expect(entryAmountIsValid("-5")).toBe(false);
    expect(entryAmountIsValid("5,50")).toBe(false);
    // Stellar carries seven decimals; an eighth is not a rounding matter.
    expect(entryAmountIsValid("5.12345678")).toBe(false);
  });
});
