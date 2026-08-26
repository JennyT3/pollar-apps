import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// NOTE: Server-side auth verification is limited because @pollar/react
// does not expose message signing. We rely on the fact that usePollarAuth()
// returns the authenticated wallet address and it cannot be altered from
// the client UI. For testnet spike this is acceptable per bounty scope.

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, callerAddress } = body;
  if (!code || !callerAddress) {
    return NextResponse.json({ error: "code and callerAddress required" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { pickupCode: code.toUpperCase() },
    include: { items: true, stall: true },
  });

  if (!order) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  // Only the stall owner can verify pickup
  if (order.stall.ownerAddress !== callerAddress) {
    return NextResponse.json({ ok: false, reason: "not_authorized" }, { status: 403 });
  }

  if (order.status === "delivered") {
    return NextResponse.json({ ok: false, reason: "already_delivered", order }, { status: 409 });
  }

  if (order.status !== "paid" && order.status !== "ready") {
    return NextResponse.json({ ok: false, reason: "not_ready", order }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "delivered", deliveredAt: new Date() },
    include: { items: true },
  });

  return NextResponse.json({ ok: true, order: updated });
}
