import { NextResponse } from "next/server";
import { createCharge, getVendorByAddress } from "@/lib/sales";

export const runtime = "nodejs";

/** POST { vendorAddress, amount, note? } → per-sale charge + pending sale. */
export async function POST(request: Request) {
  let body: { vendorAddress?: string; amount?: string; note?: string };
  try {
    body = (await request.json()) as {
      vendorAddress?: string;
      amount?: string;
      note?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vendorAddress = body.vendorAddress?.trim() ?? "";
  const amount = body.amount?.trim() ?? "";
  const note = body.note?.trim() || null;

  if (!getVendorByAddress(vendorAddress)) {
    return NextResponse.json(
      { error: "Configura tu puesto antes de cobrar" },
      { status: 400 }
    );
  }
  if (!/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }
  if (note && note.length > 80) {
    return NextResponse.json(
      { error: "La nota es demasiado larga" },
      { status: 400 }
    );
  }

  const { charge, sale } = createCharge(vendorAddress, amount, note);
  return NextResponse.json({ charge, sale });
}
