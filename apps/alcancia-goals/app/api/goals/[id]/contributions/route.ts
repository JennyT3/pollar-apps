import { NextRequest, NextResponse } from "next/server";
import { looksLikeAddress } from "@/lib/payments";
import { getGoal, addContribution, getContributionByHash, totalContributionsForGoal } from "@/lib/goals";
import { isPositiveAmount } from "@/lib/decimal";
import { verifyPaymentOnTestnet } from "@/lib/horizon";

/**
 * Records a shared-goal contribution AFTER the real payment already went
 * through client-side via PayButton/SendModal (`runTx('payment', …)`). This
 * route never moves money itself — it just persists the hash the SDK
 * returned and best-effort verifies it against Horizon testnet so the
 * history can show a verified badge.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.mode !== "shared" || !goal.keeperAddress) {
    return NextResponse.json({ error: "Contributions only apply to shared goals" }, { status: 400 });
  }

  const { address, amount, hash } = (await req.json()) ?? {};
  if (typeof address !== "string" || !looksLikeAddress(address)) {
    return NextResponse.json({ error: "address is invalid" }, { status: 400 });
  }
  if (typeof amount !== "string" || !isPositiveAmount(amount)) {
    return NextResponse.json({ error: "amount must be a positive decimal string" }, { status: 400 });
  }
  if (typeof hash !== "string" || hash.length < 10) {
    return NextResponse.json({ error: "hash is required" }, { status: 400 });
  }

  const existing = await getContributionByHash(hash);
  if (existing) {
    // Same payment reported twice (e.g. a retried request) — return it as-is.
    const saved = await totalContributionsForGoal(id);
    return NextResponse.json({ contribution: existing, saved });
  }

  let verified = false;
  try {
    verified = await verifyPaymentOnTestnet(hash, goal.keeperAddress, amount);
  } catch {
    // Horizon hiccup: the SDK already confirmed the payment, so we still
    // record it — just unverified until a retry (see README limitations).
    verified = false;
  }

  const contribution = await addContribution(id, address, amount, hash, verified);
  const saved = await totalContributionsForGoal(id);
  return NextResponse.json({ contribution, saved }, { status: 201 });
}
