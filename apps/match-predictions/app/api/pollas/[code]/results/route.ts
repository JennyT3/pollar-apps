import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { matches } from "@/db/schema";
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

const MAX_GOALS = 30;

/**
 * The organizer entering final scores.
 *
 * Results are typed in by hand (no football data feed, by design), so they are
 * editable while the polla is open: a mistyped 2-1 can be corrected and the
 * standings follow, because the table is recomputed from these rows on every
 * read. Once the polla is settled they are frozen: the pot has already been
 * divided on the strength of them.
 *
 * Passing `null` for both goals clears a result, for a match entered by mistake.
 */
export const PUT = route(async (request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const caller = await requireAddress();

  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");
  if (polla.organizerAddress !== caller) {
    throw new Forbidden("Solo el organizador carga los resultados.");
  }
  if (polla.status !== "open") {
    throw new Conflict("La polla ya se cerró: los resultados quedaron firmes.");
  }

  const body = (await request.json().catch(() => null)) as { results?: unknown } | null;
  if (!Array.isArray(body?.results)) throw new BadRequest("Faltan los resultados.");

  const input = body.results.map((raw) => {
    const row = raw as {
      matchId?: unknown;
      homeGoals?: unknown;
      awayGoals?: unknown;
    };
    if (typeof row.matchId !== "string" || !row.matchId) {
      throw new BadRequest("Un resultado no dice de qué partido es.");
    }
    if (row.homeGoals === null && row.awayGoals === null) {
      return { matchId: row.matchId, homeGoals: null, awayGoals: null };
    }
    const homeGoals = Number(row.homeGoals);
    const awayGoals = Number(row.awayGoals);
    for (const goals of [homeGoals, awayGoals]) {
      if (!Number.isInteger(goals) || goals < 0 || goals > MAX_GOALS) {
        throw new BadRequest(`Los goles van de 0 a ${MAX_GOALS}.`);
      }
    }
    return { matchId: row.matchId, homeGoals, awayGoals };
  });

  if (input.length === 0) return Response.json({ saved: 0 });

  const ids = [...new Set(input.map((row) => row.matchId))];
  const owned = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.pollaId, polla.id), inArray(matches.id, ids)));
  if (owned.length !== ids.length) {
    throw new BadRequest("Hay un resultado de un partido que no es de esta polla.");
  }

  const resultAt = Date.now();
  for (const row of input) {
    await db
      .update(matches)
      .set({
        homeGoals: row.homeGoals,
        awayGoals: row.awayGoals,
        resultAt: row.homeGoals === null ? null : resultAt,
      })
      .where(and(eq(matches.id, row.matchId), eq(matches.pollaId, polla.id)));
  }

  return Response.json({ saved: input.length });
});
