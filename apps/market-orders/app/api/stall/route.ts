import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOwnerToken, hashOwnerToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const id = req.nextUrl.searchParams.get("id");

  try {
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
    const { ownerTokenHash, ...publicStall } = stall;
    void ownerTokenHash;
    return NextResponse.json(publicStall);
  } catch (e) {
    // A cold-start DB connection (e.g. Turso in production) hiccuping must
    // return a JSON error, not crash the page.
    console.error("GET /api/stall failed", e);
    return NextResponse.json({ error: "database_unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, ownerAddress } = body;
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!ownerAddress) {
    return NextResponse.json({ error: "ownerAddress required" }, { status: 400 });
  }

  const existing = await prisma.stall.findUnique({
    where: { ownerAddress },
  });
  if (existing?.ownerTokenHash) {
    return NextResponse.json({ error: "stall_exists" }, { status: 409 });
  }
  const ownerToken = generateOwnerToken();
  const stall = existing
    ? await prisma.stall.update({
        where: { ownerAddress },
        data: { name, ownerTokenHash: hashOwnerToken(ownerToken) },
      })
    : await prisma.stall.create({
        data: { ownerAddress, name, ownerTokenHash: hashOwnerToken(ownerToken) },
      });
  return NextResponse.json({ stall, token: ownerToken });
}
