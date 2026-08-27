import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { newId, newMemoId } from "@/lib/ids";
import { findPolla } from "@/lib/queries";
import {
  BadRequest,
  Conflict,
  NotFound,
  requireAddress,
  route,
} from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Reserves a place in the polla and hands back what the payment needs.
 *
 * Nothing here says the player is in: the entry starts `pending` and only the
 * ledger can change that. What this does create is the reference: a memo id
 * that ties one incoming payment to one player in one polla, which is what
 * detection matches on later.
 *
 * Calling it twice is fine and returns the same entry: a player who reloads the
 * join page mid-payment must not end up with a second reference, or their
 * payment would settle an entry they are no longer looking at.
 */
export const POST = route(async (request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const playerAddress = await requireAddress();

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 40) {
    throw new BadRequest("Poné tu nombre, entre 2 y 40 caracteres.");
  }

  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");
  if (polla.status !== "open") {
    throw new Conflict("Esta polla ya se cerró y pagó.");
  }
  if (Date.now() >= polla.deadlineAt) {
    throw new Conflict("Los pronósticos ya cerraron: no se puede entrar.");
  }

  const [existing] = await db
    .select()
    .from(entries)
    .where(
      and(eq(entries.pollaId, polla.id), eq(entries.playerAddress, playerAddress))
    )
    .limit(1);

  if (existing) {
    // Let a player fix their name while the entry is still unpaid.
    if (existing.status === "pending" && existing.playerName !== name) {
      await db
        .update(entries)
        .set({ playerName: name })
        .where(eq(entries.id, existing.id));
    }
    return Response.json({
      entry: {
        id: existing.id,
        memoId: existing.memoId,
        amount: existing.amount,
        paid: existing.status === "paid",
      },
      destination: polla.organizerAddress,
    });
  }

  const entry = {
    id: newId(),
    pollaId: polla.id,
    playerAddress,
    playerName: name,
    memoId: newMemoId(),
    amount: polla.entryAmount,
  };
  await db.insert(entries).values(entry);

  return Response.json(
    {
      entry: {
        id: entry.id,
        memoId: entry.memoId,
        amount: entry.amount,
        paid: false,
      },
      destination: polla.organizerAddress,
    },
    { status: 201 }
  );
});
