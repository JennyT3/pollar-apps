import { NextResponse } from "next/server";
import { getVendorByCode } from "@/lib/sales";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

/** Public stall lookup by permanent QR code. */
export async function GET(_request: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const vendor = getVendorByCode(code);
  if (!vendor) {
    return NextResponse.json({ error: "Puesto no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ vendor });
}
