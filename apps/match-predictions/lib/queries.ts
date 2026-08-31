import { asc, eq, inArray } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import {
  entries,
  matches,
  payouts,
  pollas,
  predictions,
  type Polla,
} from "@/db/schema";
import { potAmount } from "@/lib/money";
import {
  buildStandings,
  type Goals,
  type ScoringRules,
  type StandingsRow,
} from "@/lib/scoring";

/**
 * Everything a screen needs about one polla, assembled in one place so the
 * page, the API and the spike all see the same numbers.
 *
 * The standings are recomputed here on every read rather than stored: results
 * are the only input that changes, and a stored table is a table that can go
 * stale against them.
 */

export interface MatchView {
  id: string;
  position: number;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: number;
  result: Goals | null;
}

export interface PlayerView {
  address: string;
  name: string;
  paid: boolean;
  amount: string;
  txHash: string | null;
  paidAt: number | null;
  joinedAt: number;
}

export interface PayoutView {
  winnerAddress: string;
  winnerName: string;
  amount: string;
  memoId: number;
  status: "prepared" | "paid" | "kept";
  txHash: string | null;
  paidAt: number | null;
}

export interface ViewerView {
  address: string | null;
  isOrganizer: boolean;
  /** The viewer's own entry, when they have one. */
  entry: { id: string; paid: boolean; memoId: number; amount: string } | null;
}

export interface PollaView {
  code: string;
  name: string;
  organizer: { address: string; name: string };
  entryAmount: string;
  deadlineAt: number;
  rules: ScoringRules;
  status: "open" | "settled";
  /** Predictions are frozen. Time-derived, never a stored flag. */
  locked: boolean;
  /** Server time, so a client with a skewed clock still locks when it should. */
  now: number;
  matches: MatchView[];
  players: PlayerView[];
  pending: PlayerView[];
  pot: { amount: string; paidCount: number };
  standings: StandingsRow[];
  /**
   * Predictions, addressed by player then match. Before the deadline this
   * holds only the viewer's own: hiding other people's bets is the rule, so it
   * is enforced here and not left to the UI.
   */
  predictions: Record<string, Record<string, Goals>>;
  /** True once everyone's predictions are on the table. */
  predictionsPublic: boolean;
  payouts: PayoutView[];
  viewer: ViewerView;
}

export async function findPolla(code: string): Promise<Polla | null> {
  await dbReady();
  const [row] = await db
    .select()
    .from(pollas)
    .where(eq(pollas.code, code.toUpperCase()))
    .limit(1);
  return row ?? null;
}

export async function loadPolla(
  polla: Polla,
  viewerAddress: string | null
): Promise<PollaView> {
  const [matchRows, entryRows, payoutRows] = await Promise.all([
    db
      .select()
      .from(matches)
      .where(eq(matches.pollaId, polla.id))
      .orderBy(asc(matches.position)),
    db
      .select()
      .from(entries)
      .where(eq(entries.pollaId, polla.id))
      .orderBy(asc(entries.createdAt)),
    db
      .select()
      .from(payouts)
      .where(eq(payouts.pollaId, polla.id))
      .orderBy(asc(payouts.winnerAddress)),
  ]);

  const paidEntries = entryRows.filter((entry) => entry.status === "paid");
  const predictionRows = paidEntries.length
    ? await db
        .select()
        .from(predictions)
        .where(
          inArray(
            predictions.entryId,
            paidEntries.map((entry) => entry.id)
          )
        )
    : [];

  const now = Date.now();
  const locked = now >= polla.deadlineAt;
  const rules: ScoringRules = {
    exactPoints: polla.exactPoints,
    outcomePoints: polla.outcomePoints,
  };

  const matchViews: MatchView[] = matchRows.map((match) => ({
    id: match.id,
    position: match.position,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoffAt: match.kickoffAt,
    result:
      match.homeGoals === null || match.awayGoals === null
        ? null
        : { homeGoals: match.homeGoals, awayGoals: match.awayGoals },
  }));

  const addressOf = new Map(paidEntries.map((entry) => [entry.id, entry.playerAddress]));

  const standings = buildStandings(
    paidEntries.map((entry) => ({
      address: entry.playerAddress,
      name: entry.playerName,
    })),
    matchViews.map((match) => ({ id: match.id, result: match.result })),
    predictionRows.flatMap((row) => {
      const address = addressOf.get(row.entryId);
      return address
        ? [
            {
              address,
              matchId: row.matchId,
              homeGoals: row.homeGoals,
              awayGoals: row.awayGoals,
            },
          ]
        : [];
    }),
    rules
  );

  // Everyone's predictions once the deadline passes; only your own before it.
  const visible: Record<string, Record<string, Goals>> = {};
  for (const row of predictionRows) {
    const address = addressOf.get(row.entryId);
    if (!address) continue;
    if (!locked && address !== viewerAddress) continue;
    (visible[address] ??= {})[row.matchId] = {
      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,
    };
  }

  const toPlayerView = (entry: (typeof entryRows)[number]): PlayerView => ({
    address: entry.playerAddress,
    name: entry.playerName,
    paid: entry.status === "paid",
    amount: entry.amount,
    txHash: entry.txHash,
    paidAt: entry.paidAt,
    joinedAt: entry.createdAt,
  });

  const viewerEntry = viewerAddress
    ? entryRows.find((entry) => entry.playerAddress === viewerAddress)
    : undefined;

  return {
    code: polla.code,
    name: polla.name,
    organizer: { address: polla.organizerAddress, name: polla.organizerName },
    entryAmount: polla.entryAmount,
    deadlineAt: polla.deadlineAt,
    rules,
    status: polla.status,
    locked,
    now,
    matches: matchViews,
    players: paidEntries.map(toPlayerView),
    pending: entryRows.filter((e) => e.status === "pending").map(toPlayerView),
    pot: {
      // Once settled the pot is the frozen figure, so a late payment landing
      // after the split cannot silently change what the winners were owed.
      amount: polla.settledPot ?? potAmount(polla.entryAmount, paidEntries.length),
      paidCount: paidEntries.length,
    },
    standings,
    predictions: visible,
    predictionsPublic: locked,
    payouts: payoutRows.map((row) => ({
      winnerAddress: row.winnerAddress,
      winnerName: row.winnerName,
      amount: row.amount,
      memoId: row.memoId,
      status: row.status,
      txHash: row.txHash,
      paidAt: row.paidAt,
    })),
    viewer: {
      address: viewerAddress,
      isOrganizer: viewerAddress === polla.organizerAddress,
      entry: viewerEntry
        ? {
            id: viewerEntry.id,
            paid: viewerEntry.status === "paid",
            memoId: viewerEntry.memoId,
            amount: viewerEntry.amount,
          }
        : null,
    },
  };
}

/** The pollas a person organizes or plays in, newest first. */
export async function listPollasFor(address: string): Promise<
  Array<{
    code: string;
    name: string;
    role: "organizer" | "player";
    status: "open" | "settled";
    deadlineAt: number;
    entryAmount: string;
    paid: boolean;
  }>
> {
  await dbReady();

  const organizing = await db
    .select()
    .from(pollas)
    .where(eq(pollas.organizerAddress, address));

  const playing = await db
    .select({ polla: pollas, entry: entries })
    .from(entries)
    .innerJoin(pollas, eq(pollas.id, entries.pollaId))
    .where(eq(entries.playerAddress, address));

  const rows = new Map<
    string,
    {
      code: string;
      name: string;
      role: "organizer" | "player";
      status: "open" | "settled";
      deadlineAt: number;
      entryAmount: string;
      paid: boolean;
      createdAt: number;
    }
  >();

  for (const row of playing) {
    rows.set(row.polla.code, {
      code: row.polla.code,
      name: row.polla.name,
      role: "player",
      status: row.polla.status,
      deadlineAt: row.polla.deadlineAt,
      entryAmount: row.polla.entryAmount,
      paid: row.entry.status === "paid",
      createdAt: row.polla.createdAt,
    });
  }

  // Organizing wins the label: it is the role with the buttons.
  for (const polla of organizing) {
    rows.set(polla.code, {
      code: polla.code,
      name: polla.name,
      role: "organizer",
      status: polla.status,
      deadlineAt: polla.deadlineAt,
      entryAmount: polla.entryAmount,
      paid: rows.get(polla.code)?.paid ?? false,
      createdAt: polla.createdAt,
    });
  }

  return [...rows.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((row) => ({
      code: row.code,
      name: row.name,
      role: row.role,
      status: row.status,
      deadlineAt: row.deadlineAt,
      entryAmount: row.entryAmount,
      paid: row.paid,
    }));
}
