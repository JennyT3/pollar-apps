import { NextRequest, NextResponse } from "next/server";
import { createSplit, listSplitsByCollector } from "@/lib/db";

export async function GET(req: NextRequest) {
  const collector = req.nextUrl.searchParams.get("collector");
  if (!collector) {
    return NextResponse.json({ error: "Missing collector" }, { status: 400 });
  }
  return NextResponse.json({ splits: await listSplitsByCollector(collector) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { description, totalAmount, assetCode, assetIssuer, collectorAddress, participants } =
    body;

  if (
    typeof description !== "string" ||
    !description.trim() ||
    typeof totalAmount !== "string" ||
    !(Number(totalAmount) > 0) ||
    typeof assetCode !== "string" ||
    typeof assetIssuer !== "string" ||
    typeof collectorAddress !== "string" ||
    !Array.isArray(participants) ||
    participants.length < 1 ||
    participants.some(
      (p) =>
        typeof p.label !== "string" ||
        !p.label.trim() ||
        typeof p.shareAmount !== "string" ||
        !(Number(p.shareAmount) > 0)
    )
  ) {
    return NextResponse.json({ error: "Invalid split payload" }, { status: 400 });
  }

  const split = await createSplit({
    description: description.trim(),
    totalAmount,
    assetCode,
    assetIssuer,
    collectorAddress,
    participants: participants.map((p: { label: string; shareAmount: string }) => ({
      label: p.label.trim(),
      shareAmount: p.shareAmount,
    })),
  });

  return NextResponse.json({ split }, { status: 201 });
}
