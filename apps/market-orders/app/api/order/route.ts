import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function genCode(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stallId, customerAddress, items, total, memo } = body;
  if (!stallId || !customerAddress || !items?.length || total == null || !memo) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Reserve stock atomically: check + decrement inside transaction
      for (const item of items) {
        if (!item.menuItemId) continue;
        const row = await tx.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!row || row.quantity < item.quantity) {
          throw new Error(`Not enough stock for ${item.name ?? item.menuItemId}`);
        }
        await tx.menuItem.update({
          where: { id: item.menuItemId },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      return tx.order.create({
        data: {
          stallId,
          customerAddress,
          total,
          status: "pending",
          txHash: null,
          pickupCode: genCode(),
          memo,
          items: {
            create: items.map((i: { name: string; price: number; quantity: number; menuItemId?: string }) => ({
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              menuItemId: i.menuItemId ?? null,
            })),
          },
        },
        include: { items: true },
      });
    });

    return NextResponse.json(order);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stock reservation failed";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}

export async function GET(req: NextRequest) {
  const stallId = req.nextUrl.searchParams.get("stallId");
  if (!stallId) {
    return NextResponse.json({ error: "stallId required" }, { status: 400 });
  }
  const orders = await prisma.order.findMany({
    where: { stallId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}
