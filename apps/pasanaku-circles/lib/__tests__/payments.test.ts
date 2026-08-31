import { describe, expect, it } from "vitest";
import type { WalletBalanceRecord } from "@pollar/core";
import { contributionAssetFrom, paymentAssetFrom } from "@/lib/payments";
import { USDC_ISSUER } from "./helpers";

const usdc = {
  type: "credit_alphanum4",
  code: "USDC",
  issuer: USDC_ISSUER,
  balance: "10",
} as WalletBalanceRecord;

const xlm = {
  type: "native",
  code: "XLM",
  balance: "10",
} as WalletBalanceRecord;

describe("contributionAssetFrom", () => {
  it("accepts usdc credit", () => {
    expect(contributionAssetFrom(usdc)).toEqual({
      type: "credit_alphanum4",
      code: "USDC",
      issuer: USDC_ISSUER,
    });
  });

  it("refuses to fall back to native xlm", () => {
    expect(() => contributionAssetFrom(xlm)).toThrow(/usdc/i);
    expect(() => contributionAssetFrom(null)).toThrow(/usdc/i);
  });
});

describe("paymentAssetFrom", () => {
  it("still falls back to native for non-contribution flows", () => {
    expect(paymentAssetFrom(null)).toEqual({ type: "native" });
  });
});
