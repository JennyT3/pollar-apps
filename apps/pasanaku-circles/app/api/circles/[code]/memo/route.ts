import { NextResponse } from "next/server";
import { getCircle, memoIdFor } from "@/lib/circles";
import { migrate } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const payer = new URL(req.url).searchParams.get("payer") ?? "";
  const circle = await getCircle(code);
  if (!circle) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await migrate();
  const row = await db.execute({
    sql: "SELECT id FROM circles WHERE code = ?",
    args: [code],
  });
  const circleId = Number(row.rows[0].id);
  return NextResponse.json({
    memoId: memoIdFor(circleId, circle.currentRound, payer),
    amount: circle.amount,
    recipient: circle.recipient,
  });
}
