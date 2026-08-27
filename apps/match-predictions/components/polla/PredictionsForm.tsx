"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MatchView } from "@/lib/queries";
import type { Goals } from "@/lib/scoring";
import { formatDateTime } from "@/lib/time";

/**
 * Your picks, while there is still time to change them.
 *
 * Everything is editable until the deadline and nothing after it, which the
 * server enforces on its own clock; this form only stops offering the inputs.
 * Blank is allowed: a match you never predict is worth nothing, and that beats
 * forcing a 0-0 you don't believe in.
 */
export function PredictionsForm({
  matches,
  values,
  saving,
  onSave,
}: {
  matches: MatchView[];
  values: Record<string, Goals>;
  saving: boolean;
  onSave: (picks: Array<{ matchId: string; homeGoals: number; awayGoals: number }>) =>
    Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, { home: string; away: string }>>(
    () =>
      Object.fromEntries(
        matches.map((match) => {
          const current = values[match.id];
          return [
            match.id,
            {
              home: current ? String(current.homeGoals) : "",
              away: current ? String(current.awayGoals) : "",
            },
          ];
        })
      )
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set(matchId: string, side: "home" | "away", raw: string) {
    // Digits only, and two of them: a score box is not a free text field.
    const value = raw.replace(/\D/g, "").slice(0, 2);
    setDraft((prev) => ({ ...prev, [matchId]: { ...prev[matchId], [side]: value } }));
    setSaved(false);
  }

  const picks = matches.flatMap((match) => {
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

  const incomplete = matches.length - picks.length;

  async function submit() {
    setError(null);
    try {
      await onSave(picks);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar.");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">Tus pronósticos</h2>
        <p className="text-sm text-muted">Podés cambiarlos hasta el cierre.</p>
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
                <ScoreInput
                  label={`Goles de ${match.homeTeam}`}
                  value={row.home}
                  onChange={(value) => set(match.id, "home", value)}
                />
                <span className="text-muted">-</span>
                <ScoreInput
                  label={`Goles de ${match.awayTeam}`}
                  value={row.away}
                  onChange={(value) => set(match.id, "away", value)}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {match.awayTeam}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {incomplete > 0 && (
        <p className="text-sm text-muted">
          Te {incomplete === 1 ? "falta" : "faltan"} {incomplete}{" "}
          {incomplete === 1 ? "partido" : "partidos"}. Los que queden en blanco no
          suman puntos.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <Button
        onClick={() => void submit()}
        loading={saving}
        disabled={picks.length === 0}
        className="w-full py-3"
      >
        {saving ? "Guardando…" : saved ? "Guardado" : "Guardar pronósticos"}
      </Button>
    </section>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      placeholder="-"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-12 shrink-0 rounded-xl border border-border bg-background text-center font-mono text-lg font-semibold tabular-nums transition-shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
    />
  );
}
