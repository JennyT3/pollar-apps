import { NextResponse } from "next/server";
import {
  createStallSale,
  getVendorByAddress,
  listSalesForVendor,
  todaysPaidSales,
} from "@/lib/sales";

export const runtime = "nodejs";

/** GET ?address=&tzOffset= → sales list + today summary. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address")?.trim() ?? "";
  const tzOffset = Number(url.searchParams.get("tzOffset") ?? "0");
  if (!/^G[A-Z2-7]{55}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const sales = listSalesForVendor(address);
  const today = todaysPaidSales(
    address,
    Number.isFinite(tzOffset) ? tzOffset : 0
  );
  const todayTotal = today.reduce((sum, s) => sum + Number(s.amount), 0);
  return NextResponse.json({
    sales,
    today: {
      count: today.length,
      total: todayTotal.toFixed(2),
      sales: today,
    },
  });
}

/** POST { vendorAddress, amount, note? } → pending stall sale (open-amount flow). */
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
    return NextResponse.json({ error: "Puesto no encontrado" }, { status: 404 });
  }
  if (!/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  const sale = createStallSale(vendorAddress, amount, note);
  return NextResponse.json({ sale });
}
