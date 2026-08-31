import { describe, expect, it } from "vitest";
import {
  adminCookieName,
  confirmPayment,
  getCircle,
  joinCircle,
  memoIdFor,
  reorderTurns,
  shuffleTurns,
} from "@/lib/circles";
import { migrate } from "@/lib/db";
import {
  A,
  B,
  C,
  D,
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

async function payAs(code: string, payer: string, hash: string) {
  const circle = await getCircle(code);
  if (!circle?.recipient) throw new Error("no recipient");
  const memo = memoIdFor(await circleId(code), circle.currentRound, payer);
  stubHorizon(
    usdcPayment({
      hash,
      from: payer,
      to: circle.recipient,
      amount: circle.amount,
      memo,
    })
  );
  return confirmPayment({ code, hash, payer });
}

describe("circle lifecycle", () => {
  it("allows join while the circle is open", async () => {
    const { code } = await threeMemberCircle();
    const circle = await getCircle(code);
    expect(circle?.status).toBe("open");
    await joinCircle(code, D);
    const after = await getCircle(code);
    expect(after?.members.map((m) => m.address)).toContain(D);
  });

  it("reorders members while open", async () => {
    const { code, adminToken } = await threeMemberCircle();
    await reorderTurns(code, adminToken, [C, A, B]);
    const circle = await getCircle(code);
    expect(circle?.members.map((m) => m.address)).toEqual([C, A, B]);
    expect(circle?.recipient).toBe(C);
  });

  it("shuffles while open and refuses after the first payment", async () => {
    const { code, adminToken } = await threeMemberCircle();
    await shuffleTurns(code, adminToken);
    const before = await getCircle(code);
    expect(new Set(before?.members.map((m) => m.turnIndex))).toEqual(
      new Set([0, 1, 2])
    );
    await payAs(code, before!.members[1].address, "first-pay");
    await expect(shuffleTurns(code, adminToken)).rejects.toThrow(/lock|active|open/i);
    await expect(reorderTurns(code, adminToken, [A, B, C])).rejects.toThrow(
      /lock|active|open/i
    );
  });

  it("locks join after the first payment", async () => {
    const { code } = await threeMemberCircle();
    await payAs(code, B, "lock-join");
    const circle = await getCircle(code);
    expect(circle?.status).toBe("active");
    await expect(joinCircle(code, D)).rejects.toThrow(/lock|active/i);
  });

  it("marks the circle completed after the last round is paid", async () => {
    const { code } = await threeMemberCircle();
    await payAs(code, B, "r1-b");
    await payAs(code, C, "r1-c");
    expect((await getCircle(code))?.currentRound).toBe(2);
    await payAs(code, A, "r2-a");
    await payAs(code, C, "r2-c");
    expect((await getCircle(code))?.currentRound).toBe(3);
    await payAs(code, A, "r3-a");
    await payAs(code, B, "r3-b");
    const done = await getCircle(code);
    expect(done?.status).toBe("completed");
    expect(done?.recipient).toBeNull();
    expect(done?.members.every((m) => m.state === "completed")).toBe(true);
    expect(done?.members.every((m) => m.state !== "up_next")).toBe(true);
  });

  it("uses a distinct admin cookie per circle code", () => {
    expect(adminCookieName("aaaa1111")).toBe("pasanaku_admin_aaaa1111");
    expect(adminCookieName("bbbb2222")).toBe("pasanaku_admin_bbbb2222");
    expect(adminCookieName("aaaa1111")).not.toBe(adminCookieName("bbbb2222"));
  });
});
