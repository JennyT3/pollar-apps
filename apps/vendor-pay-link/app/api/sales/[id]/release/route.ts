import { NextResponse } from "next/server";
import { requireSignedAddress } from "@/lib/require-session";
import { releaseSale } from "@/lib/sales";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Unlock a sale after a failed payment so the buyer can retry. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireSignedAddress(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  await releaseSale(id);
  return NextResponse.json({ ok: true });
}
