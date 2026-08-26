import { NextResponse } from "next/server";
import { requireAddress } from "@/lib/require-session";
import { matchIncomingPayments } from "@/lib/sales";

export const runtime = "nodejs";

/**
 * Vendor client posts candidate hashes from Pollar history.
 * Each hash is verified on Horizon (destination, amount, memo P-{saleId}).
 * Client-supplied amounts are not trusted.
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
  const auth = await requireAddress(request, vendorAddress);
  if (!auth.ok) return auth.response;
  const incoming = Array.isArray(body.incoming) ? body.incoming : [];
  const matched = await matchIncomingPayments(vendorAddress, incoming);
  return NextResponse.json({ matched });
}
