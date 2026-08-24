import { NextResponse } from "next/server";
import { getCharge, getSale, getVendorByAddress } from "@/lib/sales";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Public: charge details for the buyer pay page. */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const charge = getCharge(id);
  if (!charge) {
    return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
  }
  const sale = getSale(charge.saleId);
  const vendor = getVendorByAddress(charge.vendorAddress);
  return NextResponse.json({ charge, sale, vendor });
}
