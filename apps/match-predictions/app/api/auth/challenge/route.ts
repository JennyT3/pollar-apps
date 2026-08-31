import { StrKey } from "@stellar/stellar-base";
import { BadRequest, issueChallenge, route, signInMessage } from "@/lib/session";

/**
 * Step one of signing in: hand out a single-use nonce and the exact text to
 * sign. The message is built here so the client never has to reproduce its
 * wording: a byte off and the signature would verify against nothing.
 */
export const POST = route(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    address?: unknown;
  } | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";

  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new BadRequest("Esa no es una cuenta de Pollar válida.");
  }

  const { nonce, expiresAt } = await issueChallenge();
  return Response.json({
    nonce,
    expiresAt,
    message: signInMessage(address, nonce),
  });
});
