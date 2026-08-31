import { NextResponse } from "next/server";
import { qrSvg } from "@/lib/qr";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const kind = new URL(req.url).searchParams.get("kind") ?? "join";
  const origin = new URL(req.url).origin;
  const target =
    kind === "pay" ? `${origin}/c/${code}/pay` : `${origin}/c/${code}/join`;
  const svg = await qrSvg(target);
  return new NextResponse(svg, {
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
}
