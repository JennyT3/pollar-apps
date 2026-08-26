import { NextResponse } from "next/server";
import { requireAddress } from "@/lib/require-session";
import { getVendorByAddress, upsertVendor } from "@/lib/sales";

export const runtime = "nodejs";

/** GET ?address=G… → vendor profile. Requires the Pollar session for that address. */
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address || !/^G[A-Z2-7]{55}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const auth = await requireAddress(request, address);
  if (!auth.ok) return auth.response;
  const vendor = await getVendorByAddress(address);
  if (!vendor) {
    return NextResponse.json({ vendor: null });
  }
  return NextResponse.json({ vendor });
}

/** POST { address, name } → create or rename puesto. */
export async function POST(request: Request) {
  let body: { address?: string; name?: string };
  try {
    body = (await request.json()) as { address?: string; name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const address = body.address?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  if (!/^G[A-Z2-7]{55}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const auth = await requireAddress(request, address);
  if (!auth.ok) return auth.response;
  if (name.length < 2 || name.length > 48) {
    return NextResponse.json(
      { error: "El nombre del puesto debe tener entre 2 y 48 caracteres" },
      { status: 400 }
    );
  }
  const vendor = await upsertVendor(address, name);
  return NextResponse.json({ vendor });
}
