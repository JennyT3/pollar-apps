/**
 * Scoring and standings: the part of the app that decides who wins.
 *
 * Pure functions over plain data, with no database, no clock and no Pollar
 * involvement. The same inputs always produce the same table, which is what
 * lets the standings be recomputed on every read instead of stored: nothing
 * can drift out of sync with the results the organizer entered.
 *
 * The rules themselves are not hardcoded: they are declared when the polla is
 * created and travel in `ScoringRules`, so a group that scores an exact hit as
 * 5 and an outcome as 2 gets exactly that.
 */

/** Points awarded per match, declared when the polla is created. */
export interface ScoringRules {
  /** Exact final score, e.g. predicted 2-1 and it ended 2-1. */
  exactPoints: number;
  /** Right winner (or a draw), wrong score. */
  outcomePoints: number;
}

export const DEFAULT_RULES: ScoringRules = { exactPoints: 3, outcomePoints: 1 };

/** Rules the group can actually declare. Keeps the UI and the API in agreement. */
export const RULE_LIMITS = { min: 0, max: 100 } as const;

export function rulesAreValid(rules: ScoringRules): boolean {
  const inRange = (n: number) =>
    Number.isInteger(n) && n >= RULE_LIMITS.min && n <= RULE_LIMITS.max;
  return (
    inRange(rules.exactPoints) &&
    inRange(rules.outcomePoints) &&
    // An outcome worth more than the exact score it contains would let a
    // vaguer prediction beat a perfect one.
    rules.exactPoints >= rules.outcomePoints
  );
}

export type Outcome = "home" | "draw" | "away";

export function outcomeOf(homeGoals: number, awayGoals: number): Outcome {
  if (homeGoals > awayGoals) return "home";
  if (homeGoals < awayGoals) return "away";
  return "draw";
}

export type HitKind = "exact" | "outcome" | "miss" | "none";

export interface Score {
  points: number;
  kind: HitKind;
}

export interface Goals {
  homeGoals: number;
  awayGoals: number;
}

/**
 * Points for one prediction against one final score.
 *
 * `null` on either side means the match has no result yet, or the player left
 * that match blank: both are worth nothing, and both are reported as their own
 * kind so the UI can tell "wrong" from "never predicted".
 */
export function scorePrediction(
  prediction: Goals | null,
  result: Goals | null,
  rules: ScoringRules
): Score {
  if (result === null || prediction === null) return { points: 0, kind: "none" };

  if (
    prediction.homeGoals === result.homeGoals &&
    prediction.awayGoals === result.awayGoals
  ) {
    return { points: rules.exactPoints, kind: "exact" };
  }

  if (
    outcomeOf(prediction.homeGoals, prediction.awayGoals) ===
    outcomeOf(result.homeGoals, result.awayGoals)
  ) {
    return { points: rules.outcomePoints, kind: "outcome" };
  }

  return { points: 0, kind: "miss" };
}

export interface StandingsPlayer {
  /** The player's Pollar address: their id across every Pollar app. */
  address: string;
  name: string;
}

export interface StandingsMatch {
  id: string;
  result: Goals | null;
}

/** One player's prediction for one match. */
export interface StandingsPrediction {
  address: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
}

export interface StandingsRow {
  address: string;
  name: string;
  points: number;
  /** Exact hits and outcome hits, shown as detail, never used to break ties. */
  exact: number;
  outcome: number;
  missed: number;
  /** Matches already played where this player left no prediction. */
  blank: number;
  /**
   * 1 for everyone tied at the top, then 1 + however many players are strictly
   * ahead. Competition ranking: two players on 9 points are both 2nd, and the
   * next one down is 4th.
   */
  rank: number;
  /** True for every player on the top score: the set that splits the pot. */
  leader: boolean;
}

/**
 * The standings table, recomputed from scratch.
 *
 * Ordering is total and deterministic: points descending, then address
 * ascending. Address is a tiebreak for the *display order only*: players on
 * equal points share a rank and, if that rank is the top one, split the pot
 * equally. Nothing about being listed first earns anything.
 */
export function buildStandings(
  players: readonly StandingsPlayer[],
  matches: readonly StandingsMatch[],
  predictions: readonly StandingsPrediction[],
  rules: ScoringRules
): StandingsRow[] {
  const byPlayer = new Map<string, Map<string, Goals>>();
  for (const p of predictions) {
    let forPlayer = byPlayer.get(p.address);
    if (!forPlayer) {
      forPlayer = new Map();
      byPlayer.set(p.address, forPlayer);
    }
    forPlayer.set(p.matchId, { homeGoals: p.homeGoals, awayGoals: p.awayGoals });
  }

  const rows = players.map((player) => {
    const own = byPlayer.get(player.address);
    let points = 0;
    let exact = 0;
    let outcome = 0;
    let missed = 0;
    let blank = 0;

    for (const match of matches) {
      if (match.result === null) continue;
      const prediction = own?.get(match.id) ?? null;
      const score = scorePrediction(prediction, match.result, rules);
      points += score.points;
      if (score.kind === "exact") exact += 1;
      else if (score.kind === "outcome") outcome += 1;
      else if (score.kind === "miss") missed += 1;
      else blank += 1;
    }

    return {
      address: player.address,
      name: player.name,
      points,
      exact,
      outcome,
      missed,
      blank,
      rank: 0,
      leader: false,
    };
  });

  rows.sort((a, b) =>
    b.points - a.points || (a.address < b.address ? -1 : a.address > b.address ? 1 : 0)
  );

  const top = rows.length > 0 ? rows[0].points : 0;
  for (const row of rows) {
    row.rank = 1 + rows.filter((other) => other.points > row.points).length;
    // With nobody scoring yet, everyone is on 0 and nobody leads: a polla with
    // no results in has no winner to pay.
    row.leader = top > 0 && row.points === top;
  }

  return rows;
}

/**
 * The addresses that split the pot: everyone tied on the top score.
 *
 * Empty while no result has been entered, which is exactly when a polla must
 * not be settled.
 */
export function winnersOf(rows: readonly StandingsRow[]): string[] {
  return rows.filter((row) => row.leader).map((row) => row.address);
}
