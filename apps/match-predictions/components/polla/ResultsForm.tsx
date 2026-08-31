"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MatchView } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";

/**
 * The organizer typing in what actually happened.
 *
 * Results come from a person, not a data feed, so they stay editable while the
 * polla is open: the standings are recomputed from these numbers on every read,
 * and a corrected score corrects the table with it. Once the polla is settled
 * the pot has been divided on the strength of them and the server stops
 * accepting changes.
 */
export function ResultsForm({
  matches,
  saving,
  onSave,
}: {
  matches: MatchView[];
  saving: boolean;
  onSave: (
    results: Array<{ matchId: string; homeGoals: number; awayGoals: number }>
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, { home: string; away: string }>>(
    () =>
      Object.fromEntries(
        matches.map((match) => [
          match.id,
          {
            home: match.result ? String(match.result.homeGoals) : "",
            away: match.result ? String(match.result.awayGoals) : "",
          },
        ])
      )
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set(matchId: string, side: "home" | "away", raw: string) {
    const value = raw.replace(/\D/g, "").slice(0, 2);
    setDraft((prev) => ({ ...prev, [matchId]: { ...prev[matchId], [side]: value } }));
    setSaved(false);
  }

  const results = matches.flatMap((match) => {
    const row = draft[match.id];
    if (!row || row.home === "" || row.away === "") return [];
    return [
      {
        matchId: match.id,
        homeGoals: Number(row.home),
        awayGoals: Number(row.away),
      },
    ];
  });

  const missing = matches.length - results.length;

  async function submit() {
    setError(null);
    try {
      await onSave(results);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar.");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">Resultados</h2>
        <p className="text-sm text-muted">
          {missing === 0
            ? "Están todos cargados."
            : `Faltan ${missing} de ${matches.length}.`}
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {matches.map((match) => {
          const row = draft[match.id] ?? { home: "", away: "" };
          return (
            <li key={match.id} className="flex flex-col gap-2 px-4 py-3.5">
              <span className="text-xs text-muted">
                {formatDateTime(match.kickoffAt)}
              </span>
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-right font-medium">
                  {match.homeTeam}
                </span>
                <input
                  aria-label={`Goles de ${match.homeTeam}`}
                  inputMode="numeric"
                  placeholder="-"
                  value={row.home}
                  onChange={(event) => set(match.id, "home", event.target.value)}
                  className="h-12 w-12 shrink-0 rounded-xl border border-border bg-background text-center font-mono text-lg font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
                <span className="text-muted">-</span>
                <input
                  aria-label={`Goles de ${match.awayTeam}`}
                  inputMode="numeric"
                  placeholder="-"
                  value={row.away}
                  onChange={(event) => set(match.id, "away", event.target.value)}
                  className="h-12 w-12 shrink-0 rounded-xl border border-border bg-background text-center font-mono text-lg font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {match.awayTeam}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <Button
        onClick={() => void submit()}
        loading={saving}
        disabled={results.length === 0}
        className="w-full py-3"
      >
        {saving ? "Guardando…" : saved ? "Guardado" : "Guardar resultados"}
      </Button>
    </section>
  );
}
