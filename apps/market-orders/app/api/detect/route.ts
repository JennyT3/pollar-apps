import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PollarClient } from "@pollar/core";

const key = process.env.POLLAR_SECRET_KEY ?? process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY;

export async function POST(req: NextRequest) {
  if (!key) {
    return NextResponse.json({ error: "Pollar key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { stallId } = body;
  if (!stallId) {
    return NextResponse.json({ error: "stallId required" }, { status: 400 });
  }

  const stall = await prisma.stall.findUnique({ where: { id: stallId } });
  if (!stall) {
    return NextResponse.json({ error: "stall not found" }, { status: 404 });
  }

  const pendingOrders = await prisma.order.findMany({
    where: { stallId, status: "pending" },
  });

  if (pendingOrders.length === 0) {
    return NextResponse.json({ detected: 0 });
  }

  const client = new PollarClient({
    apiKey: key,
    stellarNetwork: key.startsWith("pub_mainnet_") ? "mainnet" : "testnet",
  });

  // Fetch recent tx history for the casera's account
  // Note: fetchTxHistory only shows transactions submitted through Pollar
  // For incoming payments, we check the balance instead
  try {
    const balance = await client.getWalletBalance(stall.ownerAddress);
    // We can't match specific payments from balance alone,
    // but we can detect that the balance changed
    // For the spike, we rely on the customer sending us the hash
    return NextResponse.json({
      detected: 0,
      note: "Balance-based detection. Customer must send hash after payment.",
      balance: balance.balances,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "detection failed" },
      { status: 500 }
    );
  }
}
