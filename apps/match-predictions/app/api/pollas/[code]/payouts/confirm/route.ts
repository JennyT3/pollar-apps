import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payouts } from "@/db/schema";
import { verifyPayment } from "@/lib/horizon";
import { findPolla } from "@/lib/queries";
import {
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  requireAddress,
  route,
} from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/**
 * The organizer reporting the payout they just confirmed.
 *
 * Same rule as an entry: the hash proves nothing until Horizon says it is a
 * successful USDC payment of the exact share, from the organizer, to that
 * winner, carrying that payout's reference. Only then does the polla show the
 * winner as paid, and the hash it shows is one anyone in the group can open in
 * the explorer.
 */
export const POST = route(async (request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const caller = await requireAddress();

  const body = (await request.json().catch(() => null)) as {
    winnerAddress?: unknown;
    hash?: unknown;
  } | null;
  const winnerAddress =
    typeof body?.winnerAddress === "string" ? body.winnerAddress.trim() : "";
  const hash = typeof body?.hash === "string" ? body.hash.trim() : "";
  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    throw new BadRequest("Ese no es un hash de transacción válido.");
  }

  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");
  if (polla.organizerAddress !== caller) {
    throw new Forbidden("Solo el organizador registra los pagos del pozo.");
  }

  const [payout] = await db
    .select()
    .from(payouts)
    .where(
      and(eq(payouts.pollaId, polla.id), eq(payouts.winnerAddress, winnerAddress))
    )
    .limit(1);
  if (!payout) throw new NotFound("Ese ganador no tiene un pago preparado.");
  if (payout.status === "paid") {
    return Response.json({ paid: true, txHash: payout.txHash });
  }
  if (payout.status === "kept") {
    throw new Conflict("Ese premio se queda en tu cuenta: no hay nada que enviar.");
  }

  const verification = await verifyPayment({
    hash,
    destination: payout.winnerAddress,
    source: polla.organizerAddress,
    amount: payout.amount,
    memoId: String(payout.memoId),
  });

  if (!verification.ok) {
    return Response.json(
      {
        paid: false,
        error:
          verification.error ??
          "El pago no coincide con este premio. Revisá el monto y la cuenta.",
        checks: verification.checks,
      },
      { status: 422 }
    );
  }

  try {
    await db
      .update(payouts)
      .set({
        status: "paid",
        txHash: hash,
        ledger: verification.ledger ?? null,
        paidAt: Date.now(),
      })
      .where(and(eq(payouts.id, payout.id), eq(payouts.status, "prepared")));
  } catch {
    throw new BadRequest("Ese pago ya se registró para otro premio.");
  }

  return Response.json({ paid: true, txHash: hash, checks: verification.checks });
});
