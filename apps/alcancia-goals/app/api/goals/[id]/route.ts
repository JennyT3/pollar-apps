import { NextRequest, NextResponse } from "next/server";
import {
  getGoal,
  setGoalStatus,
  totalSetAsideForGoal,
  totalContributionsForGoal,
  listMembers,
  contributionsByMember,
  listHistory,
  type GoalStatus,
} from "@/lib/goals";
import { progressRatio } from "@/lib/decimal";
import { verifySignedRequest } from "@/lib/auth";
import { statusMessage } from "@/lib/sep53";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const [saved, history] = await Promise.all([
    goal.mode === "personal" ? totalSetAsideForGoal(goal.id) : totalContributionsForGoal(goal.id),
    listHistory(goal.id),
  ]);

  const shared =
    goal.mode === "shared"
      ? {
          members: await listMembers(goal.id),
          memberTotals: await contributionsByMember(goal.id),
        }
      : null;

  return NextResponse.json({
    goal: { ...goal, saved, progress: progressRatio(saved, goal.targetAmount) },
    history,
    shared,
  });
}

const VALID_STATUSES: GoalStatus[] = ["active", "completed", "archived"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const { status } = (await req.json()) ?? {};
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as GoalStatus)) {
    return NextResponse.json({ error: "status must be active, completed or archived" }, { status: 400 });
  }

  const auth = await verifySignedRequest(req, (address, exp) => statusMessage(address, id, status, exp));
  if (!auth.ok) return auth.response;
  if (auth.address !== goal.ownerAddress) {
    return NextResponse.json({ error: "Only the goal owner can change its status" }, { status: 403 });
  }

  await setGoalStatus(id, status as GoalStatus);
  return NextResponse.json({ goal: { ...goal, status } });
}
