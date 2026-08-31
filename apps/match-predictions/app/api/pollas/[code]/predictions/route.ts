import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, matches, predictions } from "@/db/schema";
import { newId } from "@/lib/ids";
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

/** Nobody predicts a 50-goal game; a cap keeps a typo from becoming a score. */
const MAX_GOALS = 30;

interface PredictionInput {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
}

function parse(value: unknown): PredictionInput[] {
  if (!Array.isArray(value)) throw new BadRequest("Faltan los pronósticos.");
  return value.map((raw) => {
    const row = raw as {
      matchId?: unknown;
      homeGoals?: unknown;
      awayGoals?: unknown;
    };
    const homeGoals = Number(row.homeGoals);
    const awayGoals = Number(row.awayGoals);
    if (typeof row.matchId !== "string" || !row.matchId) {
      throw new BadRequest("Un pronóstico no dice de qué partido es.");
    }
    for (const goals of [homeGoals, awayGoals]) {
      if (!Number.isInteger(goals) || goals < 0 || goals > MAX_GOALS) {
        throw new BadRequest(`Los goles van de 0 a ${MAX_GOALS}.`);
      }
    }
    return { matchId: row.matchId, homeGoals, awayGoals };
  });
}

/**
 * Saves the signed-in player's predictions, all of them at once.
 *
 * Three things have to hold, and all three are checked here rather than in the
 * UI: the player paid their entry, the deadline has not passed, and the
 * predictions belong to matches in this polla. The deadline is compared against
 * the server clock, so moving a phone's clock forward changes nothing.
 *
 * Sending a subset is fine, say a player filling in one match at a time. Sending
 * the same match twice is the last value, since each row is upserted.
 */
export const PUT = route(async (request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const playerAddress = await requireAddress();

  const body = (await request.json().catch(() => null)) as {
    predictions?: unknown;
  } | null;
  const input = parse(body?.predictions);

  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");
  if (Date.now() >= polla.deadlineAt) {
    throw new Conflict("Los pronósticos ya están cerrados.");
  }

  const [entry] = await db
    .select()
    .from(entries)
    .where(
      and(eq(entries.pollaId, polla.id), eq(entries.playerAddress, playerAddress))
    )
    .limit(1);
  if (!entry) throw new NotFound("No estás en esta polla.");
  if (entry.status !== "paid") {
    throw new Forbidden("Tu entrada todavía no está pagada.");
  }

  if (input.length === 0) return Response.json({ saved: 0 });

  const ids = [...new Set(input.map((row) => row.matchId))];
  const owned = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.pollaId, polla.id), inArray(matches.id, ids)));
  if (owned.length !== ids.length) {
    throw new BadRequest("Hay un pronóstico de un partido que no es de esta polla.");
  }

  const updatedAt = Date.now();
  for (const row of input) {
    await db
      .insert(predictions)
      .values({
        id: newId(),
        entryId: entry.id,
        matchId: row.matchId,
        homeGoals: row.homeGoals,
        awayGoals: row.awayGoals,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [predictions.entryId, predictions.matchId],
        set: {
          homeGoals: row.homeGoals,
          awayGoals: row.awayGoals,
          updatedAt,
        },
      });
  }

  return Response.json({ saved: input.length, updatedAt });
});
