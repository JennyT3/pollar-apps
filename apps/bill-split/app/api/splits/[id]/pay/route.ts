import { NextResponse } from "next/server";
import {
  allParticipantsPaid,
  closeSplit,
  getParticipant,
  getSplit,
  isHashUsed,
  recordPayment,
} from "@/lib/db";
import { looksLikeAddress } from "@/lib/payments";
import { verifyPayment } from "@/lib/stellar";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { participantId, payerAddress, hash } = body as Record<string, unknown>;

  if (
    typeof participantId !== "string" ||
    typeof payerAddress !== "string" ||
    !looksLikeAddress(payerAddress) ||
    typeof hash !== "string" ||
    !hash
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const split = await getSplit(id);
  if (!split) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }
  if (split.status === "closed") {
    return NextResponse.json({ error: "This split is closed" }, { status: 409 });
  }

  const participant = await getParticipant(participantId);
  if (!participant || participant.splitId !== id) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }
  if (participant.paidAt) {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }

  if (await isHashUsed(hash)) {
    return NextResponse.json(
      { error: "This transaction has already been used to pay a share" },
      { status: 409 }
    );
  }

  const verified = await verifyPayment(hash, {
    from: payerAddress,
    to: split.collectorAddress,
    assetCode: split.assetCode,
    assetIssuer: split.assetIssuer,
    minAmount: participant.shareAmount,
  });
  if (!verified) {
    return NextResponse.json(
      { error: "Payment could not be verified on-chain" },
      { status: 422 }
    );
  }

  const recorded = await recordPayment(participantId, payerAddress, hash);
  if (!recorded) {
    return NextResponse.json(
      { error: "This share was already paid, or that transaction was already used" },
      { status: 409 }
    );
  }
  if (await allParticipantsPaid(id)) {
    await closeSplit(id);
  }

  return NextResponse.json({ split: await getSplit(id) });
}
