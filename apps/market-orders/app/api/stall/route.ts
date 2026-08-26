import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const id = req.nextUrl.searchParams.get("id");

  let stall;
  if (id) {
    stall = await prisma.stall.findUnique({
      where: { id },
      include: { items: true },
    });
  } else if (address) {
    stall = await prisma.stall.findUnique({
      where: { ownerAddress: address },
      include: { items: true },
    });
  } else {
    return NextResponse.json({ error: "address or id required" }, { status: 400 });
  }

  if (!stall) {
    return NextResponse.json({ error: "stall not found" }, { status: 404 });
  }
  return NextResponse.json(stall);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ownerAddress, name } = body;
  if (!ownerAddress || !name) {
    return NextResponse.json({ error: "ownerAddress and name required" }, { status: 400 });
  }
  const stall = await prisma.stall.upsert({
    where: { ownerAddress },
    update: { name },
    create: { ownerAddress, name },
  });
  return NextResponse.json(stall);
}
