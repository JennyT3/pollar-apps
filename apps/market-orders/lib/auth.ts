import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateOwnerToken(): string {
  return `ct_${randomBytes(24).toString("base64url")}`;
}

export function hashOwnerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function ownerTokenMatches(
  token: string | null,
  hash: string | null | undefined
): boolean {
  if (!token || !hash) return false;
  const a = Buffer.from(hashOwnerToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getOwnerTokenFromRequest(req: Request): string | null {
  return req.headers.get("x-admin-token");
}