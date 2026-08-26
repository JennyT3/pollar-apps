import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stallId, name, price, quantity } = body;
  if (!stallId || !name || price == null || quantity == null) {
    return NextResponse.json({ error: "stallId, name, price, quantity required" }, { status: 400 });
  }
  const item = await prisma.menuItem.create({
    data: { stallId, name, price, quantity },
  });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, name, price, quantity, soldOut } = body;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(price !== undefined && { price }),
      ...(quantity !== undefined && { quantity }),
      ...(soldOut !== undefined && { soldOut }),
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
