import { NextRequest, NextResponse } from "next/server";
import { looksLikeAddress } from "@/lib/payments";
import { getGoal, addMember } from "@/lib/goals";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.mode !== "shared") {
    return NextResponse.json({ error: "Only shared goals can be joined" }, { status: 400 });
  }

  const { address } = (await req.json()) ?? {};
  if (typeof address !== "string" || !looksLikeAddress(address)) {
    return NextResponse.json({ error: "address is invalid" }, { status: 400 });
  }

  await addMember(id, address);
  return NextResponse.json({ ok: true });
}
