import { NextResponse } from "next/server";
import { releaseSale } from "@/lib/sales";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Unlock a sale after a failed payment so the buyer can retry. */
export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  releaseSale(id);
  return NextResponse.json({ ok: true });
}
