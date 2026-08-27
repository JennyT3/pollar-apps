import { db, dbReady } from "@/db/client";
import { matches, pollas } from "@/db/schema";
import { newId, newPollaCode } from "@/lib/ids";
import { entryAmountIsValid, ENTRY_LIMITS } from "@/lib/money";
import { listPollasFor } from "@/lib/queries";
import { rulesAreValid } from "@/lib/scoring";
import { BadRequest, requireAddress, route } from "@/lib/session";

/** How far ahead a deadline may sit: a season, not a decade. */
const MAX_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_MATCHES = 30;

interface MatchInput {
  homeTeam: string;
  awayTeam: string;
  kickoffAt: number;
}

function text(value: unknown, field: string, min: number, max: number): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < min || trimmed.length > max) {
    throw new BadRequest(`${field} tiene que tener entre ${min} y ${max} caracteres.`);
  }
  return trimmed;
}

function parseMatches(value: unknown): MatchInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequest("Agregá al menos un partido.");
  }
  if (value.length > MAX_MATCHES) {
    throw new BadRequest(`Máximo ${MAX_MATCHES} partidos por polla.`);
  }

  return value.map((raw, index) => {
    const row = raw as { homeTeam?: unknown; awayTeam?: unknown; kickoffAt?: unknown };
    const kickoffAt = Number(row.kickoffAt);
    if (!Number.isFinite(kickoffAt) || kickoffAt <= 0) {
      throw new BadRequest(`Falta la fecha y hora del partido ${index + 1}.`);
    }
    return {
      homeTeam: text(row.homeTeam, `El local del partido ${index + 1}`, 1, 40),
      awayTeam: text(row.awayTeam, `El visitante del partido ${index + 1}`, 1, 40),
      kickoffAt,
    };
  });
}

/** The pollas the signed-in person organizes or plays in. */
export const GET = route(async () => {
  const address = await requireAddress();
  return Response.json({ pollas: await listPollasFor(address) });
});

/**
 * Creates a polla. The organizer is whoever signed the request, since the pot sits
 * in their Pollar account, so it can only ever be their own address, never one
 * typed into a form.
 */
export const POST = route(async (request: Request) => {
  const organizerAddress = await requireAddress();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) throw new BadRequest("Petición vacía.");

  const name = text(body.name, "El nombre de la polla", 3, 60);
  const organizerName = text(body.organizerName, "Tu nombre", 2, 40);

  const entryAmount = String(body.entryAmount ?? "").trim();
  if (!entryAmountIsValid(entryAmount)) {
    throw new BadRequest(
      `La entrada tiene que estar entre ${ENTRY_LIMITS.min} y ${ENTRY_LIMITS.max} USDC.`
    );
  }

  const deadlineAt = Number(body.deadlineAt);
  const now = Date.now();
  if (!Number.isFinite(deadlineAt) || deadlineAt <= now + 60_000) {
    throw new BadRequest("El cierre de pronósticos tiene que ser a futuro.");
  }
  if (deadlineAt > now + MAX_HORIZON_MS) {
    throw new BadRequest("Ese cierre está demasiado lejos.");
  }

  const rules = {
    exactPoints: Number(body.exactPoints),
    outcomePoints: Number(body.outcomePoints),
  };
  if (!rulesAreValid(rules)) {
    throw new BadRequest(
      "El puntaje no cierra: usá números enteros y no premies más el acierto de resultado que el marcador exacto."
    );
  }

  const matchInputs = parseMatches(body.matches);

  await dbReady();
  const pollaId = newId();
  // Six characters out of a 31-symbol alphabet is ~887 million codes; a
  // collision is a failed insert on the unique index, so retry rather than
  // hand two groups the same link.
  let code = newPollaCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.insert(pollas).values({
        id: pollaId,
        code,
        name,
        organizerAddress,
        organizerName,
        entryAmount,
        deadlineAt,
        exactPoints: rules.exactPoints,
        outcomePoints: rules.outcomePoints,
      });
      break;
    } catch (err) {
      if (attempt === 4) throw err;
      code = newPollaCode();
    }
  }

  await db.insert(matches).values(
    [...matchInputs]
      .sort((a, b) => a.kickoffAt - b.kickoffAt)
      .map((match, position) => ({
        id: newId(),
        pollaId,
        position,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        kickoffAt: match.kickoffAt,
      }))
  );

  return Response.json({ code }, { status: 201 });
});
