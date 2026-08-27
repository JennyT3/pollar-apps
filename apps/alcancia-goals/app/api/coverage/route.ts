import { NextRequest, NextResponse } from "next/server";
import { looksLikeAddress } from "@/lib/payments";
import { totalCommittedForOwner } from "@/lib/goals";

/**
 * Returns only the "committed" side of the coverage check (sum of set-asides
 * across the user's active personal goals). The real balance comes from the
 * Pollar SDK client-side via useBalance() — see components/CoverageBanner.tsx
 * — this route can't see it without the secret key, and shouldn't need to.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !looksLikeAddress(address)) {
    return NextResponse.json({ error: "Missing or invalid ?address" }, { status: 400 });
  }
  const committed = await totalCommittedForOwner(address);
  return NextResponse.json({ committed });
}
