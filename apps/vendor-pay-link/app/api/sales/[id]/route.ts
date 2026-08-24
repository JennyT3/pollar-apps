import { NextResponse } from "next/server";
import { getSale } from "@/lib/sales";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sale = getSale(id);
  if (!sale) {
    return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ sale });
}
