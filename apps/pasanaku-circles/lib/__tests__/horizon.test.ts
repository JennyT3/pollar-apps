import { describe, expect, it } from "vitest";
import { fetchPayment } from "@/lib/horizon";
import {
  A,
  B,
  USDC_ISSUER,
  nativePayment,
  stubHorizon,
  usdcPayment,
  isolatedDb,
} from "./helpers";

isolatedDb();

describe("fetchPayment", () => {
  it("reads the operation from field", async () => {
    stubHorizon(
      usdcPayment({
        hash: "h-from",
        from: B,
        to: A,
        amount: "10",
        memo: "1",
      })
    );
    const payment = await fetchPayment("h-from");
    expect(payment?.from).toBe(B);
    expect(payment?.to).toBe(A);
  });

  it("does not treat path_payment_strict_send as a payment", async () => {
    stubHorizon(
      usdcPayment({
        hash: "h-path",
        from: B,
        to: A,
        amount: "10",
        memo: "1",
        opType: "path_payment_strict_send",
      })
    );
    const payment = await fetchPayment("h-path");
    expect(payment?.opType).toBe("path_payment_strict_send");
    expect(payment?.paymentOpCount).toBe(0);
  });

  it("counts multiple payment operations", async () => {
    stubHorizon(
      usdcPayment({
        hash: "h-two",
        from: B,
        to: A,
        amount: "10",
        memo: "1",
        extraOps: [
          {
            type: "payment",
            from: B,
            to: A,
            amount: "0.0000001",
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: USDC_ISSUER,
          },
        ],
      })
    );
    const payment = await fetchPayment("h-two");
    expect(payment?.paymentOpCount).toBe(2);
  });

  it("marks native xlm as native", async () => {
    stubHorizon(
      nativePayment({
        hash: "h-xlm",
        from: B,
        to: A,
        amount: "10",
        memo: "1",
      })
    );
    const payment = await fetchPayment("h-xlm");
    expect(payment?.assetType).toBe("native");
    expect(payment?.assetCode).toBe("XLM");
  });
});
