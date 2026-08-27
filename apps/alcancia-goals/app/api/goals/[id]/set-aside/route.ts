import { NextRequest, NextResponse } from "next/server";
import { looksLikeAddress } from "@/lib/payments";
import { getGoal, addSetAside, totalSetAsideForGoal } from "@/lib/goals";
import { compareAmounts, isPositiveAmount, subtractAmounts } from "@/lib/decimal";

/**
 * Personal-mode only: records a set-aside (add) or take-back (withdraw)
 * against the goal owner's own balance. This never moves real money — see
 * README "Personal mode" — it only changes how much of the owner's balance
 * this goal claims.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.mode !== "personal") {
    return NextResponse.json({ error: "Set-aside only applies to personal goals" }, { status: 400 });
  }

  const { address, amount, type } = (await req.json()) ?? {};
  if (typeof address !== "string" || !looksLikeAddress(address) || address !== goal.ownerAddress) {
    return NextResponse.json({ error: "Only the goal owner can set aside or take back" }, { status: 403 });
  }
  if (typeof amount !== "string" || !isPositiveAmount(amount)) {
    return NextResponse.json({ error: "amount must be a positive decimal string" }, { status: 400 });
  }
  if (type !== "add" && type !== "withdraw") {
    return NextResponse.json({ error: "type must be 'add' or 'withdraw'" }, { status: 400 });
  }

  if (type === "withdraw") {
    const current = await totalSetAsideForGoal(id);
    if (compareAmounts(amount, current) > 0) {
      return NextResponse.json(
        { error: `Can't take back more than what's set aside (${current}).` },
        { status: 400 }
      );
    }
  }

  const signedAmount = type === "add" ? amount : subtractAmounts("0", amount);
  const setAside = await addSetAside(id, address, signedAmount);
  const saved = await totalSetAsideForGoal(id);
  return NextResponse.json({ setAside, saved }, { status: 201 });
}
