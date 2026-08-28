import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { closeSplit, getSplit } from "@/lib/db";
import { closeMessage, verifySep53 } from "@/lib/sep53";

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

export const POST = apiRoute(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { signerAddress, signature, timestamp } = body as Record<string, unknown>;
  if (
    typeof signerAddress !== "string" ||
    typeof signature !== "string" ||
    typeof timestamp !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (Math.abs(Date.now() - timestamp) > MAX_SIGNATURE_AGE_MS) {
    return NextResponse.json({ error: "Signature expired, try again" }, { status: 401 });
  }

  const split = await getSplit(id);
  if (!split) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }

  // Proves signerAddress genuinely holds the collector's private key —
  // collectorAddress alone is public on the split page, so a bare claim
  // proves nothing.
  const message = closeMessage(id, timestamp);
  if (!verifySep53(message, signature, signerAddress)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (signerAddress !== split.collectorAddress) {
    return NextResponse.json({ error: "Only the collector can close this split" }, {
      status: 403,
    });
  }

  await closeSplit(id);
  return NextResponse.json({ split: await getSplit(id) });
});
