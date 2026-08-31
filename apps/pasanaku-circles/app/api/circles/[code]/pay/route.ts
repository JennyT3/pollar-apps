import { NextResponse } from "next/server";
import { confirmPayment } from "@/lib/circles";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = (await req.json()) as { hash?: string; payer?: string };
    const result = await confirmPayment({
      code,
      hash: body.hash ?? "",
      payer: body.payer ?? "",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 400 }
    );
  }
}
