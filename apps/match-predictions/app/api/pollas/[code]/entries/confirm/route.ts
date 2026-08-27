import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { verifyPayment } from "@/lib/horizon";
import { findPolla } from "@/lib/queries";
import {
  BadRequest,
  NotFound,
  requireAddress,
  route,
} from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/**
 * The player's browser reporting "I paid, here is the hash".
 *
 * The hash is a hint, not a fact: it is checked against Horizon before the
 * entry changes state, so a made-up hash, a payment of the wrong amount, a
 * payment in another asset and a payment to another account all fail here. The
 * Horizon sweep in lib/reconcile.ts settles the same entries independently, so
 * this route is the fast path, not the only one.
 */
export const POST = route(async (request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const playerAddress = await requireAddress();

  const body = (await request.json().catch(() => null)) as { hash?: unknown } | null;
  const hash = typeof body?.hash === "string" ? body.hash.trim() : "";
  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    throw new BadRequest("Ese no es un hash de transacción válido.");
  }

  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");

  const [entry] = await db
    .select()
    .from(entries)
    .where(
      and(eq(entries.pollaId, polla.id), eq(entries.playerAddress, playerAddress))
    )
    .limit(1);
  if (!entry) throw new NotFound("Todavía no reservaste tu lugar en esta polla.");

  if (entry.status === "paid") {
    return Response.json({ paid: true, txHash: entry.txHash });
  }

  const verification = await verifyPayment({
    hash,
    destination: polla.organizerAddress,
    source: entry.playerAddress,
    amount: entry.amount,
    memoId: String(entry.memoId),
  });

  if (!verification.ok) {
    return Response.json(
      {
        paid: false,
        error:
          verification.error ??
          "El pago no coincide con esta entrada. Revisá el monto y la cuenta.",
        checks: verification.checks,
      },
      { status: 422 }
    );
  }

  try {
    const [updated] = await db
      .update(entries)
      .set({
        status: "paid",
        txHash: hash,
        ledger: verification.ledger ?? null,
        paidAt: Date.now(),
      })
      .where(and(eq(entries.id, entry.id), eq(entries.status, "pending")))
      .returning({ id: entries.id });

    if (!updated) {
      // The sweep got there first, which is a success, not a clash.
      return Response.json({ paid: true, txHash: hash });
    }
  } catch {
    throw new BadRequest("Ese pago ya se usó para otra entrada.");
  }

  return Response.json({ paid: true, txHash: hash, checks: verification.checks });
});
