import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const EXPIRY_MINUTES = 10;

export async function POST() {
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000);

  const expired = await prisma.order.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
    },
    include: { items: true },
  });

  for (const order of expired) {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.menuItemId) {
          await tx.menuItem.update({
            where: { id: item.menuItemId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: "expired" },
      });
    });
  }

  return NextResponse.json({ expired: expired.length });
}
