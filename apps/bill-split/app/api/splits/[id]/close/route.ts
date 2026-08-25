import { NextResponse } from "next/server";
import { closeSplit, getSplit } from "@/lib/db";

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
  const { collectorAddress } = body as Record<string, unknown>;
  if (typeof collectorAddress !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const split = await getSplit(id);
  if (!split) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }
  if (collectorAddress !== split.collectorAddress) {
    return NextResponse.json({ error: "Only the collector can close this split" }, {
      status: 403,
    });
  }

  await closeSplit(id);
  return NextResponse.json({ split: await getSplit(id) });
}
