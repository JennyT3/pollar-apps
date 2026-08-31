import { NextResponse } from "next/server";
import { qrSvg } from "@/lib/qr";

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("u") ?? "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  const svg = await qrSvg(url);
  return new NextResponse(svg, {
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
}
