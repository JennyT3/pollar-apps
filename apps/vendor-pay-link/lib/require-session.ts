import { NextResponse } from "next/server";
import { authMessage, PUESTO_PROOF_HEADER } from "./auth-message";
import { verifySep53 } from "./sep53";

export { authMessage, PUESTO_PROOF_HEADER } from "./auth-message";

export type PuestoProof = {
  address: string;
  exp: number;
  signature: string;
};

const MAX_TTL_MS = 10 * 60 * 1000;

/**
 * Pollar access tokens are DPoP-bound, so a Bearer token + POLLAR_SECRET_KEY
 * cannot prove the caller on our server. The live Pollar session signs a
 * short-lived SEP-53 message instead (custodial wallets sign via Pollar).
 */
export async function requireSignedAddress(
  request: Request
): Promise<
  { ok: true; address: string } | { ok: false; response: NextResponse }
> {
  const raw = request.headers.get(PUESTO_PROOF_HEADER);
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sesión Pollar requerida" },
        { status: 401 }
      ),
    };
  }
  let proof: PuestoProof;
  try {
    proof = JSON.parse(raw) as PuestoProof;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Prueba inválida" }, { status: 401 }),
    };
  }
  const address = proof.address?.trim() ?? "";
  const exp = Number(proof.exp);
  const signature = proof.signature?.trim() ?? "";
  if (!/^G[A-Z2-7]{55}$/.test(address) || !Number.isFinite(exp) || !signature) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Prueba inválida" }, { status: 401 }),
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
  const message = authMessage(address, exp);
  if (!verifySep53({ address, message, signature })) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No se pudo verificar la sesión Pollar" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, address };
}

export async function requireAddress(
  request: Request,
  expected: string
): Promise<
  { ok: true; address: string } | { ok: false; response: NextResponse }
> {
  const got = await requireSignedAddress(request);
  if (!got.ok) return got;
  if (got.address !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Esta sesión no corresponde a esa cuenta" },
        { status: 403 }
      ),
    };
  }
  return got;
}
