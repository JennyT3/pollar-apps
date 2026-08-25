import { NextRequest, NextResponse } from "next/server";
import { createSplit, listSplitsByCollector } from "@/lib/db";
import { looksLikeAddress } from "@/lib/payments";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

export async function GET(req: NextRequest) {
  const collector = req.nextUrl.searchParams.get("collector");
  if (!collector) {
    return NextResponse.json({ error: "Missing collector" }, { status: 400 });
  }
  return NextResponse.json({ splits: await listSplitsByCollector(collector) });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { description, totalAmount, assetCode, assetIssuer, collectorAddress, participants } =
    body as Record<string, unknown>;

  if (
    typeof description !== "string" ||
    !description.trim() ||
    typeof totalAmount !== "string" ||
    !AMOUNT_RE.test(totalAmount) ||
    Number(totalAmount) <= 0 ||
    typeof assetCode !== "string" ||
    !assetCode ||
    typeof assetIssuer !== "string" ||
    !assetIssuer ||
    typeof collectorAddress !== "string" ||
    !looksLikeAddress(collectorAddress) ||
    !Array.isArray(participants) ||
    participants.length < 1 ||
    participants.some(
      (p) =>
        typeof p.label !== "string" ||
        !p.label.trim() ||
        typeof p.shareAmount !== "string" ||
        !AMOUNT_RE.test(p.shareAmount) ||
        Number(p.shareAmount) <= 0
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
