import { Keypair } from "@stellar/stellar-sdk";

/**
 * The exact string both sides sign/verify for closing a split — kept in one
 * place so the client (signing) and server (verifying) can never drift.
 * Includes a timestamp so the server can bound how long a signature is
 * valid for (see `verifySep53` callers).
 */
export function closeMessage(splitId: string, timestamp: number): string {
  return `Close split ${splitId} at ${timestamp}`;
}

/**
 * Verifies a SEP-53 signature: proves `signerAddress` genuinely holds the
 * matching private key, not just that the caller knows the address — which
 * is public on the split page, so a bare "I am the collector" claim proves
 * nothing on its own.
 */
export function verifySep53(
  message: string,
  signatureBase64: string,
  signerAddress: string
): boolean {
  try {
    const signature = Buffer.from(signatureBase64, "base64");
    return Keypair.fromPublicKey(signerAddress).verifyMessage(message, signature);
  } catch {
    return false;
  }
}
