import { NextResponse } from "next/server";
import { verifySessionSignature } from "./stellar";

export const POOL_AUTH_HEADER = "x-money-pool-auth";

export type SessionProof = {
  address: string;
  exp: number;
  signature: string;
};

const MAX_TTL_MS = 10 * 60 * 1000;

export function buildSessionMessage(address: string, exp: number): string {
  return `money-pool-auth:${address}:${exp}`;
}

/**
 * Validates the DPoP signature attached to the request.
 */
export async function requireSignedAddress(
  request: Request
): Promise<
  { ok: true; address: string } | { ok: false; response: NextResponse }
> {
  const raw = request.headers.get(POOL_AUTH_HEADER);
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sesión requerida (proof no encontrado)" },
        { status: 401 }
      ),
    };
  }

  let proof: SessionProof;
  try {
    proof = JSON.parse(raw) as SessionProof;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Prueba inválida (JSON)" }, { status: 401 }),
    };
  }

  const address = proof.address?.trim() ?? "";
  const exp = Number(proof.exp);
  const signature = proof.signature?.trim() ?? "";

  if (!/^G[A-Z2-7]{55}$/.test(address) || !Number.isFinite(exp) || !signature) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Prueba inválida (Datos faltantes)" }, { status: 401 }),
    };
  }

  const now = Date.now();

  if (exp < now || exp > now + MAX_TTL_MS) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "La sesión expiró. Recarga e inténtalo de nuevo." },
        { status: 401 }
      ),
    };
  }

  const message = buildSessionMessage(address, exp);
  if (!verifySessionSignature({ address, message, signature })) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Firma inválida." },
        { status: 401 }
      ),
    };
  }

  return { ok: true, address };
}

/** 
 * Authenticates that the caller holds the private key for expectedAddress.
 */
export async function requirePoolOrganizer(
  request: Request,
  expectedAddress: string
): Promise<
  { ok: true; address: string } | { ok: false; response: NextResponse }
> {
  const got = await requireSignedAddress(request);
  if (!got.ok) return got;
  if (got.address !== expectedAddress) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Esta sesión no corresponde al organizador del pool." },
        { status: 403 }
      ),
    };
  }
  return got;
}
