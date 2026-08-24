import { NextResponse } from "next/server";
import { confirmSale } from "@/lib/sales";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Buyer (or detection poll) confirms a sale with its Stellar tx hash. */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: { txHash?: string };
  try {
    body = (await request.json()) as { txHash?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const txHash = body.txHash?.trim() ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Hash inválido" }, { status: 400 });
  }
  const result = confirmSale(id, txHash);
  if (!result.ok) {
    const status =
      result.code === "already_paid" || result.code === "duplicate_tx"
        ? 409
        : 404;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status }
    );
  }
  return NextResponse.json({ sale: result.sale });
}
