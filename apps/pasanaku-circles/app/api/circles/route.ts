import { NextResponse } from "next/server";
import {
  adminCookieName,
  createCircle,
  listCirclesFor,
  type Frequency,
} from "@/lib/circles";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  const circles = await listCirclesFor(address);
  return NextResponse.json({ circles });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      amount?: string;
      frequency?: Frequency;
      organizerAddress?: string;
    };
    const created = await createCircle({
      name: body.name ?? "",
      amount: body.amount ?? "",
      frequency: body.frequency ?? "weekly",
      organizerAddress: body.organizerAddress ?? "",
    });
    const res = NextResponse.json({ code: created.code });
    res.cookies.set(adminCookieName(created.code), created.adminToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 400 }
    );
  }
}
