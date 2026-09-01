import { NextRequest, NextResponse } from "next/server";
import { getGoal, addContribution, getContributionByHash, totalContributionsForGoal } from "@/lib/goals";
import { isPositiveAmount } from "@/lib/decimal";
import { verifyContributionOnTestnet } from "@/lib/horizon";

/**
 * Records a shared-goal contribution AFTER the real payment already went
 * through client-side via PayButton/ContributeFlow (`runTx('payment', …)`,
 * memo-bound to this goal's id). This route never moves money itself — it
 * verifies the hash against Horizon testnet (destination, amount, USDC
 * asset+issuer, success, memo) and only then persists it, with the
 * contributor address taken from the chain, never from the request body. A
 * contribution that can't be verified is rejected outright, not recorded.
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

  const { amount, hash } = (await req.json()) ?? {};
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

  const contributorAddress = await verifyContributionOnTestnet(hash, goal.keeperAddress, amount, id);
  if (!contributorAddress) {
    return NextResponse.json(
      {
        error:
          "No pudimos verificar ese pago en testnet (destino, monto, USDC o la referencia de la meta no coinciden). No se registró.",
      },
      { status: 422 }
    );
  }

  const contribution = await addContribution(id, contributorAddress, amount, hash, true);
  const saved = await totalContributionsForGoal(id);
  return NextResponse.json({ contribution, saved }, { status: 201 });
}
