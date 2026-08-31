import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminCookieName, getCircle, isAdmin } from "@/lib/circles";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const circle = await getCircle(code);
  if (!circle) return NextResponse.json({ error: "not found" }, { status: 404 });
  const token = (await cookies()).get(adminCookieName(code))?.value ?? "";
  const canManageTurns =
    circle.status === "open" && token !== "" && (await isAdmin(code, token));
  return NextResponse.json({ ...circle, canManageTurns });
}
