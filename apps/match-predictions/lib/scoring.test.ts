import { describe, expect, it } from "vitest";
import {
  buildStandings,
  DEFAULT_RULES,
  outcomeOf,
  rulesAreValid,
  scorePrediction,
  winnersOf,
  type StandingsMatch,
  type StandingsPlayer,
  type StandingsPrediction,
} from "@/lib/scoring";

/**
 * The rules that decide who takes the pot.
 *
 * A run of the app can only ever show one arrangement of results, and the
 * single-winner case is the easy one. What is worth pinning down here is the
 * case the money depends on and a demo rarely produces: several players tied at
 * the top, which is the set `winnersOf` hands to `splitPot`.
 */

// Short stand-ins for Pollar addresses. Only their sort order matters, and
// being first in that order is never worth anything.
const ANA = "GA_ANA";
const BETO = "GB_BETO";
const CARO = "GC_CARO";
const DANI = "GD_DANI";

describe("scorePrediction", () => {
  it("pays the exact score when both goals match", () => {
    expect(
      scorePrediction(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        DEFAULT_RULES
      )
    ).toEqual({ points: 3, kind: "exact" });
  });

  it("pays the outcome when the winner is right and the score is not", () => {
    expect(
      scorePrediction(
        { homeGoals: 3, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        DEFAULT_RULES
      )
    ).toEqual({ points: 1, kind: "outcome" });
  });

  it("pays the outcome for a draw called with the wrong score", () => {
    expect(
      scorePrediction(
        { homeGoals: 1, awayGoals: 1 },
        { homeGoals: 0, awayGoals: 0 },
        DEFAULT_RULES
      )
    ).toEqual({ points: 1, kind: "outcome" });
  });

  it("pays nothing for the wrong winner", () => {
    expect(
      scorePrediction(
        { homeGoals: 0, awayGoals: 2 },
        { homeGoals: 2, awayGoals: 1 },
        DEFAULT_RULES
      )
    ).toEqual({ points: 0, kind: "miss" });
  });

  it("separates a match with no result from one left blank", () => {
    expect(
      scorePrediction({ homeGoals: 1, awayGoals: 0 }, null, DEFAULT_RULES)
    ).toEqual({ points: 0, kind: "none" });
    expect(
      scorePrediction(null, { homeGoals: 1, awayGoals: 0 }, DEFAULT_RULES)
    ).toEqual({ points: 0, kind: "none" });
  });

  it("applies whatever the group declared, not the defaults", () => {
    const house = { exactPoints: 5, outcomePoints: 2 };
    expect(
      scorePrediction(
        { homeGoals: 2, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        house
      ).points
    ).toBe(5);
    expect(
      scorePrediction(
        { homeGoals: 4, awayGoals: 1 },
        { homeGoals: 2, awayGoals: 1 },
        house
      ).points
    ).toBe(2);
  });
});

describe("outcomeOf", () => {
  it("reads the three outcomes off a score", () => {
    expect(outcomeOf(2, 1)).toBe("home");
    expect(outcomeOf(1, 2)).toBe("away");
    expect(outcomeOf(0, 0)).toBe("draw");
  });
});

describe("rulesAreValid", () => {
  it("accepts the defaults and a zero-point outcome", () => {
    expect(rulesAreValid(DEFAULT_RULES)).toBe(true);
    expect(rulesAreValid({ exactPoints: 1, outcomePoints: 0 })).toBe(true);
  });

  it("refuses an outcome worth more than the exact score that contains it", () => {
    expect(rulesAreValid({ exactPoints: 1, outcomePoints: 3 })).toBe(false);
  });

  it("refuses fractions, negatives and anything past the limit", () => {
    expect(rulesAreValid({ exactPoints: 2.5, outcomePoints: 1 })).toBe(false);
    expect(rulesAreValid({ exactPoints: 3, outcomePoints: -1 })).toBe(false);
    expect(rulesAreValid({ exactPoints: 101, outcomePoints: 1 })).toBe(false);
  });
});

describe("buildStandings", () => {
  const players: StandingsPlayer[] = [
    { address: ANA, name: "Ana" },
    { address: BETO, name: "Beto" },
    { address: CARO, name: "Caro" },
    { address: DANI, name: "Dani" },
  ];

  const matches: StandingsMatch[] = [
    { id: "m1", result: { homeGoals: 2, awayGoals: 1 } },
    { id: "m2", result: { homeGoals: 0, awayGoals: 0 } },
  ];

  const predictions: StandingsPrediction[] = [
    // Ana: exact on m1, right draw with the wrong score on m2. 3 + 1 = 4.
    { address: ANA, matchId: "m1", homeGoals: 2, awayGoals: 1 },
    { address: ANA, matchId: "m2", homeGoals: 1, awayGoals: 1 },
    // Beto: the same total by the other route. 1 + 3 = 4.
    { address: BETO, matchId: "m1", homeGoals: 3, awayGoals: 1 },
    { address: BETO, matchId: "m2", homeGoals: 0, awayGoals: 0 },
    // Caro: both wrong.
    { address: CARO, matchId: "m1", homeGoals: 0, awayGoals: 2 },
    { address: CARO, matchId: "m2", homeGoals: 1, awayGoals: 0 },
    // Dani predicted nothing at all.
  ];

  const rows = buildStandings(players, matches, predictions, DEFAULT_RULES);
  const rowOf = (address: string) => rows.find((row) => row.address === address)!;

  it("adds up points across matches", () => {
    expect(rowOf(ANA).points).toBe(4);
    expect(rowOf(BETO).points).toBe(4);
    expect(rowOf(CARO).points).toBe(0);
    expect(rowOf(DANI).points).toBe(0);
  });

  it("counts hits, misses and blanks apart", () => {
    expect(rowOf(ANA)).toMatchObject({ exact: 1, outcome: 1, missed: 0, blank: 0 });
    expect(rowOf(BETO)).toMatchObject({ exact: 1, outcome: 1, missed: 0, blank: 0 });
    expect(rowOf(CARO)).toMatchObject({ exact: 0, outcome: 0, missed: 2, blank: 0 });
    expect(rowOf(DANI)).toMatchObject({ exact: 0, outcome: 0, missed: 0, blank: 2 });
  });

  it("ranks by competition rules, so a tie shares the place", () => {
    expect(rowOf(ANA).rank).toBe(1);
    expect(rowOf(BETO).rank).toBe(1);
    // Two players are strictly ahead of the pair on zero, so they are 3rd.
    expect(rowOf(CARO).rank).toBe(3);
    expect(rowOf(DANI).rank).toBe(3);
  });

  it("marks every player on the top score as a leader", () => {
    expect(rowOf(ANA).leader).toBe(true);
    expect(rowOf(BETO).leader).toBe(true);
    expect(rowOf(CARO).leader).toBe(false);
    expect(rowOf(DANI).leader).toBe(false);
  });

  it("orders the table by points, then by address, never by name", () => {
    expect(rows.map((row) => row.address)).toEqual([ANA, BETO, CARO, DANI]);
  });

  it("gives nobody the lead while no result is in", () => {
    const pending = buildStandings(
      players,
      [{ id: "m1", result: null }],
      predictions,
      DEFAULT_RULES
    );
    expect(pending.every((row) => row.points === 0)).toBe(true);
    expect(pending.every((row) => row.leader === false)).toBe(true);
  });

  it("holds up with no players at all", () => {
    expect(buildStandings([], matches, [], DEFAULT_RULES)).toEqual([]);
  });
});

describe("winnersOf", () => {
  const players: StandingsPlayer[] = [
    { address: ANA, name: "Ana" },
    { address: BETO, name: "Beto" },
    { address: CARO, name: "Caro" },
  ];
  const matches: StandingsMatch[] = [
    { id: "m1", result: { homeGoals: 2, awayGoals: 1 } },
  ];

  const standingsFrom = (predictions: StandingsPrediction[]) =>
    buildStandings(players, matches, predictions, DEFAULT_RULES);

  it("returns every player tied at the top: the set that splits the pot", () => {
    const rows = standingsFrom([
      { address: ANA, matchId: "m1", homeGoals: 2, awayGoals: 1 },
      { address: BETO, matchId: "m1", homeGoals: 2, awayGoals: 1 },
      { address: CARO, matchId: "m1", homeGoals: 0, awayGoals: 3 },
    ]);
    expect(winnersOf(rows)).toEqual([ANA, BETO]);
  });

  it("returns the single winner when there is no tie", () => {
    const rows = standingsFrom([
      { address: ANA, matchId: "m1", homeGoals: 2, awayGoals: 1 },
      { address: BETO, matchId: "m1", homeGoals: 4, awayGoals: 1 },
      { address: CARO, matchId: "m1", homeGoals: 0, awayGoals: 3 },
    ]);
    expect(winnersOf(rows)).toEqual([ANA]);
  });

  it("returns nobody when no player scored, so there is nothing to settle on", () => {
    const rows = standingsFrom([
      { address: ANA, matchId: "m1", homeGoals: 0, awayGoals: 1 },
      { address: BETO, matchId: "m1", homeGoals: 0, awayGoals: 2 },
      { address: CARO, matchId: "m1", homeGoals: 0, awayGoals: 3 },
    ]);
    expect(winnersOf(rows)).toEqual([]);
  });
});
