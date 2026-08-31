import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { Keypair, StrKey } from "@stellar/stellar-base";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import { challenges, sessions } from "@/db/schema";

/**
 * Who is making this request.
 *
 * The Pollar SDK gives the browser a session, but nothing the browser can hand
 * a server that a server can check: a `user.address` arriving in a request body
 * proves nothing, because anyone can type someone else's address. In a polla
 * that matters more than usual: the whole premise is that you cannot edit your
 * bet after the goal, and that only the organizer enters results.
 *
 * So the app asks for a proof instead. The SDK signs an arbitrary message with
 * the user's Stellar key under SEP-53 (`client.stellar.sep53.signMessage`), and
 * this file verifies that signature against the address the caller claims. A
 * valid signature is proof of control of the account; anything less is refused.
 *
 * The flow, once per browser:
 *
 *   1. `POST /api/auth/challenge` → a single-use nonce, stored with an expiry.
 *   2. the client signs a message that names the app, the address and the nonce.
 *   3. `POST /api/auth/session` → the signature is verified, the nonce burned,
 *      and a random token is set as an httpOnly cookie. Only its SHA-256 is
 *      stored, so a leaked database row cannot be replayed as a session.
 *
 * Reads never need any of this: the standings, the pot and the history are open
 * to the whole group, and to anyone holding the link.
 */

const COOKIE = "polla_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** SEP-53 framing. The signer prepends exactly this before hashing. */
const SEP53_PREFIX = "Stellar Signed Message:\n";

export const SIGN_IN_PURPOSE = "La Polla · iniciar sesión";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The exact text the client is asked to sign. Built identically on both sides. */
export function signInMessage(address: string, nonce: string): string {
  return [
    SIGN_IN_PURPOSE,
    `cuenta: ${address}`,
    `código: ${nonce}`,
    "Firmar no mueve dinero ni autoriza ningún pago.",
  ].join("\n");
}

/**
 * Verifies a SEP-53 signature over `message` for `address`.
 *
 * SEP-53 signs the SHA-256 of the prefixed message. Some signers hand the raw
 * prefixed bytes to ed25519 instead and let it hash internally, so both
 * framings are accepted: each one still requires the account's private key, so
 * accepting the pair costs nothing in strength and saves the app from breaking
 * on a wallet that frames it the other way.
 */
export function verifySep53(
  address: string,
  message: string,
  signatureBase64: string
): boolean {
  if (!StrKey.isValidEd25519PublicKey(address)) return false;

  let signature: Buffer;
  try {
    signature = Buffer.from(signatureBase64, "base64");
  } catch {
    return false;
  }
  if (signature.length !== 64) return false;

  const payload = Buffer.concat([
    Buffer.from(SEP53_PREFIX, "utf8"),
    Buffer.from(message, "utf8"),
  ]);
  const digest = createHash("sha256").update(payload).digest();

  try {
    const keypair = Keypair.fromPublicKey(address);
    return keypair.verify(digest, signature) || keypair.verify(payload, signature);
  } catch {
    return false;
  }
}

/** Hands out a single-use nonce and clears the expired ones. */
export async function issueChallenge(): Promise<{
  nonce: string;
  expiresAt: number;
}> {
  await dbReady();
  const now = Date.now();
  await db.delete(challenges).where(lt(challenges.expiresAt, now));

  const nonce = randomBytes(18).toString("base64url");
  const expiresAt = now + CHALLENGE_TTL_MS;
  await db.insert(challenges).values({ nonce, expiresAt });
  return { nonce, expiresAt };
}

/**
 * Burns a nonce. Returns false if it was never issued, already used or
 * expired. The delete is the check, so two requests racing on the same nonce
 * cannot both win.
 */
export async function consumeChallenge(nonce: string): Promise<boolean> {
  await dbReady();
  const deleted = await db
    .delete(challenges)
    .where(and(eq(challenges.nonce, nonce), gt(challenges.expiresAt, Date.now())))
    .returning({ nonce: challenges.nonce });
  return deleted.length === 1;
}

/** Starts a session for an address whose signature already checked out. */
export async function startSession(address: string): Promise<void> {
  await dbReady();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    address,
    expiresAt,
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await dbReady();
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  jar.delete(COOKIE);
}

/** The address this browser has proved it controls, or null. */
export async function currentAddress(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  await dbReady();
  const hash = sha256(token);
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hash))
    .limit(1);

  if (!row || row.expiresAt < Date.now()) return null;
  // The lookup is already by hash; the explicit compare keeps the check
  // constant-time even if this ever stops being an indexed equality.
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return row.address;
}

export class Unauthorized extends Error {}
export class Forbidden extends Error {}
export class BadRequest extends Error {}
export class NotFound extends Error {}
export class Conflict extends Error {}

export async function requireAddress(): Promise<string> {
  const address = await currentAddress();
  if (!address) {
    throw new Unauthorized(
      "Firmá con tu cuenta de Pollar para continuar."
    );
  }
  return address;
}

const STATUS: Array<[new (message: string) => Error, number]> = [
  [Unauthorized, 401],
  [Forbidden, 403],
  [BadRequest, 400],
  [NotFound, 404],
  [Conflict, 409],
];

/**
 * Wraps a route handler: turns the errors above into their status codes and
 * anything unexpected into a 500 that says nothing about the internals.
 */
export function route<Ctx>(
  handler: (request: Request, ctx: Ctx) => Promise<Response>
) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      for (const [type, status] of STATUS) {
        if (err instanceof type) {
          return Response.json({ error: err.message }, { status });
        }
      }
      console.error("[polla]", err);
      return Response.json({ error: "Algo salió mal." }, { status: 500 });
    }
  };
}
