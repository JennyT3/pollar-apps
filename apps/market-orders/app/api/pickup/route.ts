import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnerTokenFromRequest, ownerTokenMatches } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = getOwnerTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ ok: false, reason: "missing_admin_token" }, { status: 401 });
  }

  const body = await req.json();
  const { code } = body;
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { pickupCode: code.toUpperCase() },
    include: { items: true, stall: true },
  });

  if (!order) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  if (!ownerTokenMatches(token, order.stall.ownerTokenHash)) {
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
