import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnerTokenFromRequest, ownerTokenMatches } from "@/lib/auth";

function genCode(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function genMemo(stallId: string): string {
  const ts = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 4);
  return `O${stallId.slice(0, 4)}${ts}${suffix}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stallId, items, customerAddress } = body;
  if (!stallId || !items?.length) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  // The customer id comes from the client, so validate it server-side: it
  // must be a Stellar G-address (the payer's Pollar wallet id).
  if (typeof customerAddress !== "string" || !/^G[A-Z2-7]{55}$/.test(customerAddress.trim())) {
    return NextResponse.json({ error: "invalid_customer_address" }, { status: 400 });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const stall = await tx.stall.findUnique({ where: { id: stallId } });
      if (!stall) throw new Error("stall not found");

      let total = 0;
      const lines: { name: string; price: number; quantity: number; menuItemId?: string }[] = [];
      for (const item of items) {
        if (!item.menuItemId) continue;
        const row = await tx.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!row) {
          throw new Error(`Item not found: ${item.menuItemId}`);
        }
        if (row.soldOut || row.quantity < item.quantity) {
          throw new Error(`Not enough stock for ${row.name}`);
        }
        const qty = Math.max(1, Math.floor(Number(item.quantity)));
        total += row.price * qty;
        lines.push({ name: row.name, price: row.price, quantity: qty, menuItemId: row.id });
      }
      if (lines.length === 0) throw new Error("no valid items");
      total = Math.round(total * 1e7) / 1e7;

      for (const line of lines) {
        await tx.menuItem.update({
          where: { id: line.menuItemId },
          data: { quantity: { decrement: line.quantity } },
        });
      }

      return tx.order.create({
        data: {
          stallId,
          customerAddress: customerAddress.trim(),
          total,
          status: "pending",
          txHash: null,
          pickupCode: genCode(),
          memo: genMemo(stallId),
          items: {
            create: lines.map((l) => ({
              name: l.name,
              price: l.price,
              quantity: l.quantity,
              menuItemId: l.menuItemId,
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
  try {
    const stall = await prisma.stall.findUnique({ where: { id: stallId } });
    if (!ownerTokenMatches(getOwnerTokenFromRequest(req), stall?.ownerTokenHash)) {
      return NextResponse.json({ error: "invalid_admin_token" }, { status: 401 });
    }
    const orders = await prisma.order.findMany({
      where: { stallId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch (e) {
    console.error("GET /api/order failed", e);
    return NextResponse.json({ error: "database_unavailable" }, { status: 500 });
  }
}