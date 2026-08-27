import { describe, expect, it } from "vitest";
import { DEFAULT_USDC_ISSUER, stroops, usdcIssuer } from "@/lib/asset";

describe("stroops", () => {
  it("treats trailing zeros as the same amount", () => {
    expect(stroops("10")).toBe(100_000_000n);
    expect(stroops("10.0")).toBe(100_000_000n);
    expect(stroops("10.0000000")).toBe(100_000_000n);
  });

  it("does not equate 10 with 10.0000001", () => {
    expect(stroops("10")).not.toBe(stroops("10.0000001"));
  });

  it("rejects extra precision that is not zero", () => {
    expect(() => stroops("10.00000001")).toThrow();
  });
});

describe("usdcIssuer", () => {
  it("defaults to circle testnet usdc", () => {
    expect(DEFAULT_USDC_ISSUER).toBe(
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    );
    expect(usdcIssuer()).toBe(DEFAULT_USDC_ISSUER);
  });
});
