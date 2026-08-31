import { StrKey } from "@stellar/stellar-base";
import {
  BadRequest,
  consumeChallenge,
  currentAddress,
  endSession,
  route,
  signInMessage,
  startSession,
  Unauthorized,
  verifySep53,
} from "@/lib/session";

/** Who this browser has proved it is. Null is a normal answer, not an error. */
export const GET = route(async () => {
  return Response.json({ address: await currentAddress() });
});

/**
 * Step two of signing in: check the SEP-53 signature against the address the
 * caller claims, burn the nonce and open a session.
 *
 * The nonce is consumed before the signature is checked, so a wrong signature
 * costs the caller a fresh challenge rather than letting them grind attempts
 * against one.
 */
export const POST = route(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    address?: unknown;
    nonce?: unknown;
    signature?: unknown;
  } | null;

  const address = typeof body?.address === "string" ? body.address.trim() : "";
  const nonce = typeof body?.nonce === "string" ? body.nonce : "";
  const signature = typeof body?.signature === "string" ? body.signature : "";

  if (!StrKey.isValidEd25519PublicKey(address) || !nonce || !signature) {
    throw new BadRequest("Faltan datos para iniciar sesión.");
  }

  if (!(await consumeChallenge(nonce))) {
    throw new Unauthorized("Ese código de firma ya se usó o venció. Probá de nuevo.");
  }

  if (!verifySep53(address, signInMessage(address, nonce), signature)) {
    throw new Unauthorized("La firma no corresponde a esa cuenta.");
  }

  await startSession(address);
  return Response.json({ address });
});

export const DELETE = route(async () => {
  await endSession();
  return Response.json({ address: null });
});
