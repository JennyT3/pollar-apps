import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  adminCookieName,
  reorderTurns,
  shuffleTurns,
} from "@/lib/circles";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const jar = await cookies();
    const adminToken = jar.get(adminCookieName(code))?.value ?? "";
    if (!adminToken) {
      return NextResponse.json({ error: "not authorized" }, { status: 401 });
    }
    const body = (await req.json()) as { shuffle?: boolean; order?: string[] };
    if (body.shuffle) {
      await shuffleTurns(code, adminToken);
    } else if (Array.isArray(body.order)) {
      await reorderTurns(code, adminToken, body.order);
    } else {
      throw new Error("shuffle or order required");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    const status = message === "not authorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
