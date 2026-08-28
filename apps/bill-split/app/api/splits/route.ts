import { NextRequest, NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { createSplit, listSplitsByCollector } from "@/lib/db";
import { looksLikeAddress } from "@/lib/payments";
import { TESTNET_USDC } from "@/lib/split";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

export const GET = apiRoute(async (req: NextRequest) => {
  const collector = req.nextUrl.searchParams.get("collector");
  if (!collector) {
    return NextResponse.json({ error: "Missing collector" }, { status: 400 });
  }
  return NextResponse.json({ splits: await listSplitsByCollector(collector) });
});

export const POST = apiRoute(async (req: NextRequest) => {
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
    assetCode !== TESTNET_USDC.code ||
    assetIssuer !== TESTNET_USDC.issuer ||
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
});
