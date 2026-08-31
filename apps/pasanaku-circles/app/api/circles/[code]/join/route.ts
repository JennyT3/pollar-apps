import { NextResponse } from "next/server";
import { joinCircle } from "@/lib/circles";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = (await req.json()) as { address?: string };
    await joinCircle(code, body.address ?? "");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 400 }
    );
  }
}
