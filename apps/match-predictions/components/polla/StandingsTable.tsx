"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import type { ScoringRules, StandingsRow } from "@/lib/scoring";

/**
 * The standings: the screen this whole app exists to show.
 *
 * A table on desktop, a stack of rows on a phone, because that is where it will
 * actually be read, passed around a group chat during the second half. Points
 * are recomputed from the results on every load, so what everyone sees is
 * always the same number.
 */
export function StandingsTable({
  rows,
  rules,
  played,
  total,
  viewerAddress,
  settled,
}: {
  rows: StandingsRow[];
  rules: ScoringRules;
  /** Matches with a result in. */
  played: number;
  total: number;
  viewerAddress: string | null;
  settled: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay nadie adentro"
        description="La tabla se arma con los que ya pagaron su entrada. Compartí el QR y empieza el juego."
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">Tabla de posiciones</h2>
        <p className="text-sm text-muted">
          {played} de {total} {total === 1 ? "partido jugado" : "partidos jugados"}
          {" · "}
          <span className="font-mono">{rules.exactPoints}</span> pts exacto,{" "}
          <span className="font-mono">{rules.outcomePoints}</span> pts resultado
        </p>
      </header>

      <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {rows.map((row) => {
          const isViewer = row.address === viewerAddress;
          return (
            <li
              key={row.address}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                row.leader ? "bg-primary-light" : "bg-background"
              }`}
            >
              <span
                aria-label={`Puesto ${row.rank}`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold tabular-nums ${
                  row.leader
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted"
                }`}
              >
                {row.rank}
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 truncate font-semibold">
                  <span className="truncate">{row.name}</span>
                  {isViewer && (
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
                      vos
                    </span>
                  )}
                  {row.leader && played > 0 && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                      {settled ? "ganador" : "puntero"}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted">
                  {row.exact} exactos · {row.outcome} resultados
                  {row.blank > 0 && ` · ${row.blank} sin pronosticar`}
                </span>
              </div>

              <span className="shrink-0 text-right">
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {row.points}
                </span>
                <span className="ml-1 text-xs text-muted">pts</span>
              </span>
            </li>
          );
        })}
      </ol>

      {played === 0 && (
        <p className="text-sm text-muted">
          Todos empiezan en cero. La tabla se mueve cuando el organizador carga
          el primer resultado.
        </p>
      )}
    </section>
  );
}
