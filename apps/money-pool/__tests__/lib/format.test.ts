import { describe, it, expect } from "vitest";
import { formatPoolAmount } from "../../lib/format";

describe("formatPoolAmount", () => {
  it("truncates amounts with many decimals to 2 decimals", () => {
    expect(formatPoolAmount("45.5000000")).toBe("45.50");
    expect(formatPoolAmount("45.5678")).toBe("45.56");
  });

  it("pads amounts with no decimals to 2 decimals", () => {
    expect(formatPoolAmount("45")).toBe("45.00");
  });

  it("handles null or empty gracefully", () => {
    expect(formatPoolAmount(null)).toBe("0.00");
    expect(formatPoolAmount("")).toBe("0.00");
  });

  it("handles thousands separators if implemented", () => {
    // If the implementation adds commas
    expect(formatPoolAmount("1000.50")).toBe("1,000.50");
    expect(formatPoolAmount("1000000")).toBe("1,000,000.00");
  });
});
