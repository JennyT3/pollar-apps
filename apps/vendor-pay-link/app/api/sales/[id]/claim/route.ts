import { NextResponse } from "next/server";
import { requireSignedAddress } from "@/lib/require-session";
import { claimSale } from "@/lib/sales";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Lock the sale before sending the on-chain payment (anti double-pay). */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireSignedAddress(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const result = await claimSale(id);
  if (!result.ok) {
    const status =
      result.code === "already_paid"
        ? 409
        : result.code === "in_progress"
          ? 409
          : 404;
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status }
    );
  }
  return NextResponse.json({ sale: result.sale });
}
