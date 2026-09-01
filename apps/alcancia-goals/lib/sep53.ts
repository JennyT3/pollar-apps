import { Keypair } from "@stellar/stellar-sdk";

/** Header carrying the signed proof: `{ address, exp, signature }` as JSON. */
export const AUTH_HEADER = "x-alcancia-auth";

/** How long a signature stays valid after signing — bounds replay of a captured header. */
export const AUTH_TTL_MS = 5 * 60 * 1000;

/**
 * The exact strings the client signs and the server verifies for each
 * write — one action, one goal, one address, time-boxed — kept in one place
 * so client and server can never drift. Addresses are public (visible on the
 * goal page/QR/history), so a bare "I am the owner" claim in a request body
 * proves nothing; these bind the request to a signature only the holder of
 * that address's private key could produce.
 */
export function statusMessage(address: string, goalId: string, status: string, exp: number): string {
  return `alcancia-goals:set-status:${address}:${goalId}:${status}:${exp}`;
}

export function setAsideMessage(
  address: string,
  goalId: string,
  type: "add" | "withdraw",
  amount: string,
  exp: number
): string {
  return `alcancia-goals:set-aside:${address}:${goalId}:${type}:${amount}:${exp}`;
}

export function joinMessage(address: string, goalId: string, exp: number): string {
  return `alcancia-goals:join:${address}:${goalId}:${exp}`;
}

/** Verifies a SEP-53 signature proves `signerAddress` holds the matching private key. */
export function verifySep53(message: string, signatureBase64: string, signerAddress: string): boolean {
  try {
    const signature = Buffer.from(signatureBase64, "base64");
    return Keypair.fromPublicKey(signerAddress).verifyMessage(message, signature);
  } catch {
    return false;
  }
}
