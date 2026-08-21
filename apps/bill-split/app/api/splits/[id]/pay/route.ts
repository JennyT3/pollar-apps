import { NextResponse } from "next/server";
import {
  allParticipantsPaid,
  closeSplit,
  getParticipant,
  getSplit,
  recordPayment,
} from "@/lib/db";
import { verifyPayment } from "@/lib/stellar";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { participantId, payerAddress, hash } = body;

  if (
    typeof participantId !== "string" ||
    typeof payerAddress !== "string" ||
    typeof hash !== "string"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const split = await getSplit(id);
  if (!split) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }

  const participant = await getParticipant(participantId);
  if (!participant || participant.splitId !== id) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }
  if (participant.paidAt) {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }

  const verified = await verifyPayment(hash, {
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

  await recordPayment(participantId, payerAddress, hash);
  if (await allParticipantsPaid(id)) {
    await closeSplit(id);
  }

  return NextResponse.json({ split: await getSplit(id) });
}
