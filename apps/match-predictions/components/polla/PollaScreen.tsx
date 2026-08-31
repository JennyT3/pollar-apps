"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HistoryList } from "@/components/polla/HistoryList";
import { InviteQr } from "@/components/polla/InviteQr";
import { PayoutPanel } from "@/components/polla/PayoutPanel";
import { PotCard } from "@/components/polla/PotCard";
import { PredictionsBoard } from "@/components/polla/PredictionsBoard";
import { PredictionsForm } from "@/components/polla/PredictionsForm";
import { ResultsForm } from "@/components/polla/ResultsForm";
import { StandingsTable } from "@/components/polla/StandingsTable";
import { Button } from "@/components/ui/Button";
import { useAppSession } from "@/hooks/useAppSession";
import { useBalance } from "@/hooks/useBalance";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { api } from "@/lib/api";
import type { PollaView } from "@/lib/queries";

type Tab = "tabla" | "pronosticos" | "movimientos" | "organizar";

/** How often an open polla refreshes itself while somebody is watching it. */
const REFRESH_MS = 12_000;

/**
 * The polla, live.
 *
 * One screen for the whole group: the standings first, because that is what
 * everybody opens it for, and everything else a tab away. It refreshes on a
 * timer while the polla is open, which is also what nudges the server to sweep
 * the organizer's account for entries that were paid but never reported.
 */
export function PollaScreen({ initial }: { initial: PollaView }) {
  const [polla, setPolla] = useState(initial);
  const [tab, setTab] = useState<Tab>("tabla");
  const [saving, setSaving] = useState(false);
  const { user } = usePollarAuth();
  const { currency } = useBalance();
  const { ensure, busy: signing, error: sessionError } = useAppSession();

  const code = polla.code;

  // A dropped read is not worth an error banner: the screen keeps showing the
  // last good state and tries again on the next tick.
  const read = useCallback(
    () =>
      api<{ polla: PollaView }>(`/api/pollas/${code}`)
        .then((res) => res.polla)
        .catch(() => null),
    [code]
  );

  const refresh = useCallback(async () => {
    const fresh = await read();
    if (fresh) setPolla(fresh);
  }, [read]);

  // Logging in changes what the server is willing to send back (your own
  // predictions, the organizer's controls), so re-read when that changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fresh = await read();
      if (!cancelled && fresh) setPolla(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [read, user?.address]);

  useEffect(() => {
    if (polla.status !== "open") return;
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [polla.status, refresh]);

  const isOrganizer = Boolean(user && user.address === polla.organizer.address);
  const myEntry = polla.viewer.entry;
  const iPlay = Boolean(myEntry?.paid);
  const played = polla.matches.filter((match) => match.result !== null).length;

  async function withSession<T>(action: () => Promise<T>): Promise<T> {
    await ensure();
    setSaving(true);
    try {
      const result = await action();
      await refresh();
      return result;
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "tabla", label: "Tabla", show: true },
    { id: "pronosticos", label: "Pronósticos", show: true },
    { id: "movimientos", label: "Movimientos", show: true },
    { id: "organizar", label: "Organizar", show: isOrganizer },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{polla.name}</h1>
        <p className="text-sm text-muted">
          Organiza {polla.organizer.name} · código{" "}
          <span className="font-mono font-semibold">{polla.code}</span>
        </p>
      </div>

      <PotCard
        amount={polla.pot.amount}
        currency={currency ?? "USDC"}
        players={polla.pot.paidCount}
        entryAmount={polla.entryAmount}
        deadlineAt={polla.deadlineAt}
        locked={polla.locked}
        settled={polla.status === "settled"}
      />

      {!iPlay && polla.status === "open" && !polla.locked && (
        <Link href={`/p/${polla.code}/unirse`} className="block">
          <Button className="w-full py-3">
            {myEntry ? "Terminar de pagar tu entrada" : "Entrar a la polla"}
          </Button>
        </Link>
      )}

      {sessionError && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {sessionError}
        </p>
      )}

      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1">
        {tabs
          .filter((entry) => entry.show)
          .map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === entry.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {entry.label}
            </button>
          ))}
      </nav>

      {tab === "tabla" && (
        <>
          <StandingsTable
            rows={polla.standings}
            rules={polla.rules}
            played={played}
            total={polla.matches.length}
            viewerAddress={user?.address ?? null}
            settled={polla.status === "settled"}
          />
          {polla.status === "settled" && (
            <PayoutPanel
              polla={polla}
              isOrganizer={isOrganizer}
              onSettle={() => withSession(() => settle(polla.code))}
              onPaid={(winnerAddress, hash) =>
                withSession(() => confirmPayout(polla.code, winnerAddress, hash))
              }
            />
          )}
        </>
      )}

      {tab === "pronosticos" && (
        <>
          {polla.locked ? (
            <PredictionsBoard
              matches={polla.matches}
              players={polla.players}
              predictions={polla.predictions}
              rules={polla.rules}
              viewerAddress={user?.address ?? null}
            />
          ) : iPlay ? (
            <PredictionsForm
              key={user?.address ?? "anon"}
              matches={polla.matches}
              values={polla.predictions[user?.address ?? ""] ?? {}}
              saving={saving || signing}
              onSave={(picks) =>
                withSession(() => savePredictions(polla.code, picks))
              }
            />
          ) : (
            <p className="rounded-2xl border border-border px-4 py-8 text-center text-sm text-muted">
              Pagá tu entrada y vas a poder cargar tus pronósticos hasta el
              cierre.
            </p>
          )}
        </>
      )}

      {tab === "movimientos" && <HistoryList polla={polla} />}

      {tab === "organizar" && isOrganizer && (
        <div className="flex flex-col gap-8">
          <InviteQr code={polla.code} name={polla.name} />
          {polla.status === "open" && (
            <ResultsForm
              matches={polla.matches}
              saving={saving || signing}
              onSave={(results) =>
                withSession(() => saveResults(polla.code, results))
              }
            />
          )}
          {polla.status === "open" && (
            <PayoutPanel
              polla={polla}
              isOrganizer
              onSettle={() => withSession(() => settle(polla.code))}
              onPaid={(winnerAddress, hash) =>
                withSession(() => confirmPayout(polla.code, winnerAddress, hash))
              }
            />
          )}
          {polla.pending.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-bold tracking-tight">Sin pagar</h2>
              <p className="text-sm text-muted">
                Reservaron su lugar pero todavía no llegó el pago. No cuentan
                para el pozo ni para la tabla.
              </p>
              <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
                {polla.pending.map((player) => (
                  <li
                    key={player.address}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="truncate">{player.name}</span>
                    <span className="font-mono text-muted">{player.amount}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

async function savePredictions(
  code: string,
  predictions: Array<{ matchId: string; homeGoals: number; awayGoals: number }>
): Promise<void> {
  await api(`/api/pollas/${code}/predictions`, {
    method: "PUT",
    json: { predictions },
  });
}

async function saveResults(
  code: string,
  results: Array<{ matchId: string; homeGoals: number; awayGoals: number }>
): Promise<void> {
  await api(`/api/pollas/${code}/results`, { method: "PUT", json: { results } });
}

async function settle(code: string): Promise<void> {
  await api(`/api/pollas/${code}/settle`, { method: "POST" });
}

async function confirmPayout(
  code: string,
  winnerAddress: string,
  hash: string
): Promise<void> {
  await api(`/api/pollas/${code}/payouts/confirm`, {
    method: "POST",
    json: { winnerAddress, hash },
  });
}
