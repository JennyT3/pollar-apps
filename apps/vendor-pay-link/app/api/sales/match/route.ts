import { NextResponse } from "next/server";
import { matchIncomingPayments } from "@/lib/sales";

export const runtime = "nodejs";

/**
 * Vendor client posts parsed incoming txs from Pollar history.
 * Matches them to pending sales by amount (memo is not in history API).
 */
export async function POST(request: Request) {
  let body: {
    vendorAddress?: string;
    incoming?: { hash: string; amount: string; createdAt?: string }[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const vendorAddress = body.vendorAddress?.trim() ?? "";
  if (!/^G[A-Z2-7]{55}$/.test(vendorAddress)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const incoming = Array.isArray(body.incoming) ? body.incoming : [];
  const matched = matchIncomingPayments(vendorAddress, incoming);
  return NextResponse.json({ matched });
}
