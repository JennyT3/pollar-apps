import { NextRequest, NextResponse } from "next/server";
import { looksLikeAddress } from "@/lib/payments";
import { createGoal, listGoalsForAddress, totalSetAsideForGoal, totalContributionsForGoal } from "@/lib/goals";
import { progressRatio } from "@/lib/decimal";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !looksLikeAddress(address)) {
    return NextResponse.json({ error: "Missing or invalid ?address" }, { status: 400 });
  }
  const goals = await listGoalsForAddress(address);
  const withProgress = await Promise.all(
    goals.map(async (goal) => {
      const saved =
        goal.mode === "personal"
          ? await totalSetAsideForGoal(goal.id)
          : await totalContributionsForGoal(goal.id);
      return { ...goal, saved, progress: progressRatio(saved, goal.targetAmount) };
    })
  );
  return NextResponse.json({ goals: withProgress });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, emoji, targetAmount, deadline, mode, currency, ownerAddress } = body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof ownerAddress !== "string" || !looksLikeAddress(ownerAddress)) {
    return NextResponse.json({ error: "ownerAddress is invalid" }, { status: 400 });
  }
  if (mode !== "personal" && mode !== "shared") {
    return NextResponse.json({ error: "mode must be 'personal' or 'shared'" }, { status: 400 });
  }
  const amountNumber = Number(targetAmount);
  if (typeof targetAmount !== "string" || !Number.isFinite(amountNumber) || amountNumber <= 0) {
    return NextResponse.json({ error: "targetAmount must be a positive number" }, { status: 400 });
  }

  const goal = await createGoal({
    name: name.trim(),
    emoji: typeof emoji === "string" && emoji ? emoji : "🐷",
    targetAmount,
    deadline: typeof deadline === "string" && deadline ? deadline : null,
    mode,
    currency: typeof currency === "string" && currency ? currency : "USDC",
    ownerAddress,
  });
  return NextResponse.json({ goal }, { status: 201 });
}
