import { describe, expect, it } from "vitest";
import { confirmPayment, getCircle, memoIdFor } from "@/lib/circles";
import { migrate } from "@/lib/db";
import {
  A,
  B,
  C,
  USDC_ISSUER,
  nativePayment,
  stubHorizon,
  threeMemberCircle,
  usdcPayment,
  isolatedDb,
} from "./helpers";

isolatedDb();

async function circleId(code: string): Promise<number> {
  const db = await migrate();
  const row = await db.execute({
    sql: "SELECT id FROM circles WHERE code = ?",
    args: [code],
  });
  return Number(row.rows[0].id);
}

describe("confirmPayment", () => {
  it("rejects native xlm with the same amount as the circle", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      nativePayment({
        hash: "xlm-10",
        from: B,
        to: A,
        amount: "10",
        memo,
      })
    );
    await expect(
      confirmPayment({ code, hash: "xlm-10", payer: B })
    ).rejects.toThrow(/asset|usdc|native|xlm/i);
    const circle = await getCircle(code);
    expect(circle?.history).toHaveLength(0);
  });

  it("rejects usdc from a different issuer", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "other-issuer",
        from: B,
        to: A,
        amount: "10",
        memo,
        issuer: "G" + "E".repeat(55),
      })
    );
    await expect(
      confirmPayment({ code, hash: "other-issuer", payer: B })
    ).rejects.toThrow(/issuer|asset/i);
  });

  it("rejects when operation.from does not match the posted payer", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "paid-by-b",
        from: B,
        to: A,
        amount: "10",
        memo,
      })
    );
    await expect(
      confirmPayment({ code, hash: "paid-by-b", payer: C })
    ).rejects.toThrow(/from|payer|sender/i);
  });

  it("rejects a missing memo", async () => {
    const { code } = await threeMemberCircle("10");
    stubHorizon(
      usdcPayment({
        hash: "no-memo",
        from: B,
        to: A,
        amount: "10",
        memo: "ignored",
        includeMemo: false,
      })
    );
    await expect(
      confirmPayment({ code, hash: "no-memo", payer: B })
    ).rejects.toThrow(/memo/i);
  });

  it("rejects a memo id that does not match this payer and round", async () => {
    const { code } = await threeMemberCircle("10");
    stubHorizon(
      usdcPayment({
        hash: "wrong-memo",
        from: B,
        to: A,
        amount: "10",
        memo: "999",
      })
    );
    await expect(
      confirmPayment({ code, hash: "wrong-memo", payer: B })
    ).rejects.toThrow(/memo/i);
  });

  it("rejects payer equal to the current recipient", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, A);
    stubHorizon(
      usdcPayment({
        hash: "self-pay",
        from: A,
        to: A,
        amount: "10",
        memo,
      })
    );
    await expect(
      confirmPayment({ code, hash: "self-pay", payer: A })
    ).rejects.toThrow(/recipient|self/i);
    const circle = await getCircle(code);
    expect(circle?.currentRound).toBe(1);
    expect(circle?.history).toHaveLength(0);
  });

  it("rejects path_payment_strict_send even when destination and amount look right", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "path",
        from: B,
        to: A,
        amount: "10",
        memo,
        opType: "path_payment_strict_send",
      })
    );
    await expect(
      confirmPayment({ code, hash: "path", payer: B })
    ).rejects.toThrow(/path|operation|payment/i);
  });

  it("rejects a transaction that mixes a payment with another operation", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "mixed-ops",
        from: B,
        to: A,
        amount: "10",
        memo,
        extraOps: [{ type: "manage_data", from: B, to: A, amount: "0" }],
      })
    );
    await expect(
      confirmPayment({ code, hash: "mixed-ops", payer: B })
    ).rejects.toThrow(/operation/i);
  });

  it("rejects a transaction with two payment operations", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "two-ops",
        from: B,
        to: A,
        amount: "10",
        memo,
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
    await expect(
      confirmPayment({ code, hash: "two-ops", payer: B })
    ).rejects.toThrow(/operation/i);
  });

  it("accepts a well-formed usdc payment from a non-recipient member", async () => {
    const { code } = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "ok-usdc",
        from: B,
        to: A,
        amount: "10.0000000",
        memo,
      })
    );
    const result = await confirmPayment({ code, hash: "ok-usdc", payer: B });
    expect(result.round).toBe(1);
    expect(result.recipient).toBe(A);
    const circle = await getCircle(code);
    expect(circle?.history).toHaveLength(1);
    expect(circle?.members.find((m) => m.address === B)?.paid).toBe(true);
  });

  it("does not credit a second circle with a hash already used", async () => {
    const first = await threeMemberCircle("10");
    const memo = memoIdFor(await circleId(first.code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "shared-across-circles",
        from: B,
        to: A,
        amount: "10",
        memo,
      })
    );
    await confirmPayment({ code: first.code, hash: "shared-across-circles", payer: B });

    const second = await threeMemberCircle("10");
    const memo2 = memoIdFor(await circleId(second.code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "shared-across-circles",
        from: B,
        to: A,
        amount: "10",
        memo: memo2,
      })
    );
    await expect(
      confirmPayment({ code: second.code, hash: "shared-across-circles", payer: B })
    ).rejects.toThrow(/already used/i);
    expect((await getCircle(second.code))?.history).toHaveLength(0);
    expect((await getCircle(second.code))?.status).toBe("open");
  });

  it("does not credit a second member who posts the same hash", async () => {
    const { code } = await threeMemberCircle("10");
    const memoB = memoIdFor(await circleId(code), 1, B);
    stubHorizon(
      usdcPayment({
        hash: "shared-hash",
        from: B,
        to: A,
        amount: "10",
        memo: memoB,
      })
    );
    await confirmPayment({ code, hash: "shared-hash", payer: B });
    await expect(
      confirmPayment({ code, hash: "shared-hash", payer: C })
    ).rejects.toThrow();
    const circle = await getCircle(code);
    expect(circle?.history).toHaveLength(1);
    expect(circle?.members.find((m) => m.address === C)?.paid).toBe(false);
  });

  it("does not advance the round when the recipient tries to self-pay", async () => {
    const { code } = await threeMemberCircle("10");
    const memoC = memoIdFor(await circleId(code), 1, C);
    stubHorizon(
      usdcPayment({
        hash: "c-pays",
        from: C,
        to: A,
        amount: "10",
        memo: memoC,
      })
    );
    await confirmPayment({ code, hash: "c-pays", payer: C });

    const memoA = memoIdFor(await circleId(code), 1, A);
    stubHorizon(
      usdcPayment({
        hash: "a-self",
        from: A,
        to: A,
        amount: "10",
        memo: memoA,
      })
    );
    await expect(
      confirmPayment({ code, hash: "a-self", payer: A })
    ).rejects.toThrow(/recipient|self/i);
    const circle = await getCircle(code);
    expect(circle?.currentRound).toBe(1);
  });
});
