import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, txHash, callerAddress } = body;
  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  // For delivery: verify the caller is the stall owner
  if (status === "delivered" && callerAddress) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { stall: true },
    });
    if (!order) {
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    }
    if (order.stall.ownerAddress !== callerAddress) {
      return NextResponse.json({ error: "not authorized" }, { status: 403 });
    }
  }

  const update: Record<string, unknown> = { status };
  if (txHash) update.txHash = txHash;
  if (status === "paid") update.detectedAt = new Date();
  if (status === "delivered") update.deliveredAt = new Date();

  const order = await prisma.order.update({
    where: { id },
    data: update,
    include: { items: true },
  });

  // Restore stock on cancellation
  if (status === "cancelled") {
    for (const item of order.items) {
      if (item.menuItemId) {
        await prisma.menuItem.update({
          where: { id: item.menuItemId },
          data: { quantity: { increment: item.quantity } },
        });
      }
    }
  }

  return NextResponse.json(order);
}
