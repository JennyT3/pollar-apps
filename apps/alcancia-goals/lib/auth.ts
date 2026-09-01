import { NextResponse } from "next/server";
import { looksLikeAddress } from "@/lib/payments";
import { AUTH_HEADER, AUTH_TTL_MS, verifySep53 } from "@/lib/sep53";

/**
 * Verifies a write request carries a fresh SEP-53 signature over
 * `buildMessage(address, exp)`, where `address` and `exp` come from the
 * `x-alcancia-auth` header. Returns the proven address (never the caller's
 * unverified claim) or a ready-to-return error response.
 */
export async function verifySignedRequest(
  req: Request,
  buildMessage: (address: string, exp: number) => string
): Promise<{ ok: true; address: string } | { ok: false; response: NextResponse }> {
  const raw = req.headers.get(AUTH_HEADER);
  if (!raw) {
    return { ok: false, response: NextResponse.json({ error: "Falta la firma de la wallet" }, { status: 401 }) };
  }

  let proof: { address?: unknown; exp?: unknown; signature?: unknown };
  try {
    proof = JSON.parse(raw);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Firma inválida" }, { status: 401 }) };
  }

  const address = typeof proof.address === "string" ? proof.address.trim() : "";
  const exp = Number(proof.exp);
  const signature = typeof proof.signature === "string" ? proof.signature.trim() : "";
  if (!looksLikeAddress(address) || !Number.isFinite(exp) || !signature) {
    return { ok: false, response: NextResponse.json({ error: "Firma inválida" }, { status: 401 }) };
  }

  const now = Date.now();
  if (exp < now || exp > now + AUTH_TTL_MS) {
    return { ok: false, response: NextResponse.json({ error: "La firma expiró, probá de nuevo" }, { status: 401 }) };
  }

  if (!verifySep53(buildMessage(address, exp), signature, address)) {
    return { ok: false, response: NextResponse.json({ error: "Firma inválida" }, { status: 401 }) };
  }

  return { ok: true, address };
}
