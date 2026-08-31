import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payouts, pollas } from "@/db/schema";
import { newId, newMemoId } from "@/lib/ids";
import { potAmount, potStroops, splitPot } from "@/lib/money";
import { findPolla, loadPolla } from "@/lib/queries";
import { syncEntries } from "@/lib/reconcile";
import { winnersOf } from "@/lib/scoring";
import {
  Conflict,
  Forbidden,
  NotFound,
  requireAddress,
  route,
} from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Closes the polla and works out who gets paid.
 *
 * This is the one moment the numbers stop moving, so it does three things in
 * order and refuses to guess at any of them:
 *
 *  1. One last forced sweep of the organizer's account, so a player who paid
 *     while the last match was ending is counted before the pot is frozen.
 *  2. The pot is fixed at (entry × paid entries) and stored, so a payment
 *     landing afterwards cannot change what the winners were already owed.
 *  3. The winners are everyone tied on the top score, and the pot is split
 *     between them to the stroop (lib/money.ts).
 *
 * If nobody scored a single point, there is no winner to reward and the pot
 * goes back: it is divided equally among everyone who paid. Money the group put
 * in never stays with the app or, silently, with the organizer.
 *
 * The payouts it writes are *prepared*, not sent. This app never holds funds
 * and never moves them on its own: each one becomes a prefilled payment the
 * organizer confirms from their own wallet. The only exception is a winner who
 * is the organizer, whose share is already in the right account and is recorded
 * as `kept` rather than invented as a transfer.
 */
export const POST = route(async (_request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const caller = await requireAddress();

  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");
  if (polla.organizerAddress !== caller) {
    throw new Forbidden("Solo el organizador cierra la polla.");
  }
  if (polla.status !== "open") throw new Conflict("Esta polla ya está cerrada.");

  await syncEntries(polla, { force: true }).catch(() => undefined);

  const view = await loadPolla(polla, caller);

  if (view.matches.some((match) => match.result === null)) {
    throw new Conflict("Cargá el resultado de todos los partidos antes de cerrar.");
  }
  if (view.players.length === 0) {
    throw new Conflict("Nadie pagó su entrada: no hay pozo que repartir.");
  }

  const scored = winnersOf(view.standings);
  // Nobody on the board: the pot goes back to the players, not to the house.
  const winners = scored.length > 0 ? scored : view.players.map((p) => p.address);

  const pot = potStroops(polla.entryAmount, view.players.length);
  const shares = splitPot(pot, winners);
  const nameOf = new Map(view.players.map((player) => [player.address, player.name]));

  // Re-runnable while the polla is still open: a settle that failed halfway
  // leaves nothing to reconcile by hand.
  await db.delete(payouts).where(eq(payouts.pollaId, polla.id));
  await db.insert(payouts).values(
    shares.map((share) => ({
      id: newId(),
      pollaId: polla.id,
      winnerAddress: share.address,
      winnerName: nameOf.get(share.address) ?? share.address,
      amount: share.amount,
      memoId: newMemoId(),
      status:
        share.address === polla.organizerAddress
          ? ("kept" as const)
          : ("prepared" as const),
      paidAt: share.address === polla.organizerAddress ? Date.now() : null,
    }))
  );

  const [settled] = await db
    .update(pollas)
    .set({
      status: "settled",
      settledPot: potAmount(polla.entryAmount, view.players.length),
      settledAt: Date.now(),
    })
    .where(eq(pollas.id, polla.id))
    .returning({ id: pollas.id });

  if (!settled) throw new Conflict("No se pudo cerrar la polla.");

  const after = await findPolla(code);
  return Response.json({
    polla: await loadPolla(after!, caller),
    refunded: scored.length === 0,
  });
});
