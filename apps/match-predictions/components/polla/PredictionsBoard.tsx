"use client";

import type { MatchView, PlayerView } from "@/lib/queries";
import { scorePrediction, type Goals, type ScoringRules } from "@/lib/scoring";
import { formatDateTime } from "@/lib/time";

/**
 * Everyone's predictions, once the deadline has passed.
 *
 * The reason the app exists in the first place: before kickoff nobody sees
 * anybody else's picks, and after it everybody sees all of them, next to the
 * real result and the points they earned. The server decides what to send here,
 * so there is nothing to peek at in the payload before the deadline.
 *
 * Grouped by match rather than laid out as a player-by-match grid, because a
 * grid of ten players and eight matches is unreadable on the phone this gets
 * opened on.
 */
export function PredictionsBoard({
  matches,
  players,
  predictions,
  rules,
  viewerAddress,
}: {
  matches: MatchView[];
  players: PlayerView[];
  predictions: Record<string, Record<string, Goals>>;
  rules: ScoringRules;
  viewerAddress: string | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">Pronósticos de todos</h2>
        <p className="text-sm text-muted">
          Congelados al cierre. Nadie los puede tocar.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {matches.map((match) => (
          <article
            key={match.id}
            className="overflow-hidden rounded-2xl border border-border"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">
                  {match.homeTeam} vs {match.awayTeam}
                </span>
                <span className="text-xs text-muted">
                  {formatDateTime(match.kickoffAt)}
                </span>
              </div>
              <span className="font-mono text-xl font-semibold tabular-nums">
                {match.result
                  ? `${match.result.homeGoals} - ${match.result.awayGoals}`
                  : "sin resultado"}
              </span>
            </header>

            <ul className="flex flex-col divide-y divide-border">
              {players.map((player) => {
                const pick = predictions[player.address]?.[match.id] ?? null;
                const score = scorePrediction(pick, match.result, rules);
                return (
                  <li
                    key={player.address}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {player.name}
                      {player.address === viewerAddress && (
                        <span className="ml-2 text-xs text-muted">(vos)</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums">
                      {pick ? `${pick.homeGoals} - ${pick.awayGoals}` : "sin jugar"}
                    </span>
                    <span
                      className={`w-16 shrink-0 text-right font-mono text-sm font-semibold tabular-nums ${
                        score.kind === "exact"
                          ? "text-success"
                          : score.kind === "outcome"
                            ? "text-primary"
                            : "text-muted-light"
                      }`}
                    >
                      {match.result ? `+${score.points}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
