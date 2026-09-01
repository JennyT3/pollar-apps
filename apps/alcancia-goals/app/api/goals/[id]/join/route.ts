import { NextRequest, NextResponse } from "next/server";
import { getGoal, addMember } from "@/lib/goals";
import { verifySignedRequest } from "@/lib/auth";
import { joinMessage } from "@/lib/sep53";

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

  const auth = await verifySignedRequest(req, (address, exp) => joinMessage(address, id, exp));
  if (!auth.ok) return auth.response;

  await addMember(id, auth.address);
  return NextResponse.json({ ok: true });
}
