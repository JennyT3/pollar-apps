import { createHash } from "crypto";
import { Keypair } from "@stellar/stellar-base";

const SEP53_PREFIX = "Stellar Signed Message:\n";

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

function decodeSignature(signature: string): Buffer | null {
  const trimmed = signature.trim();
  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 64) return b64;
  } catch {
    /* try hex */
  }
  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  return null;
}

/** Verify a Pollar/SEP-53 message signature against a G… address. */
export function verifySep53(opts: {
  address: string;
  message: string;
  signature: string;
}): boolean {
  if (!/^G[A-Z2-7]{55}$/.test(opts.address)) return false;
  const sig = decodeSignature(opts.signature);
  if (!sig) return false;
  const payload = Buffer.concat([
    Buffer.from(SEP53_PREFIX, "utf8"),
    Buffer.from(opts.message, "utf8"),
  ]);
  const digest = sha256(payload);
  try {
    return Keypair.fromPublicKey(opts.address).verify(digest, sig);
  } catch {
    return false;
  }
}
