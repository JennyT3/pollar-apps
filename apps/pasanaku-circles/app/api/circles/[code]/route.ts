import { NextResponse } from "next/server";
import { getCircle } from "@/lib/circles";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const circle = await getCircle(code);
  if (!circle) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(circle);
}
