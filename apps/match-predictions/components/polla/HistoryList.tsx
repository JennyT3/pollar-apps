"use client";

import { middleTruncate } from "@/lib/format";
import type { PollaView } from "@/lib/queries";
import { explorerTxUrl } from "@/lib/stellar";
import { formatDateTime } from "@/lib/time";

/**
 * Every movement of the pot, in one list.
 *
 * The app holds no money, so the only thing that makes it trustworthy is that
 * each entry in and each payout out is a real transaction anyone can open in
 * the explorer. Nothing here is a number this app invented: every row with a
 * hash was checked against the ledger before it was written.
 */
export function HistoryList({ polla }: { polla: PollaView }) {
  const rows = [
    ...polla.players
      .filter((player) => player.paid)
      .map((player) => ({
        key: `entry-${player.address}`,
        kind: "entrada" as const,
        who: player.name,
        amount: `+${player.amount}`,
        at: player.paidAt,
        hash: player.txHash,
      })),
    ...polla.payouts.map((payout) => ({
      key: `payout-${payout.winnerAddress}`,
      kind: payout.status === "kept" ? ("premio retenido" as const) : ("premio" as const),
      who: payout.winnerName,
      amount: `-${payout.amount}`,
      at: payout.paidAt,
      hash: payout.txHash,
    })),
  ].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border px-4 py-6 text-center text-sm text-muted">
        Todavía no hay movimientos. El primero será la entrada de alguien.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold tracking-tight">Movimientos</h2>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {row.who}{" "}
                <span className="font-normal text-muted">({row.kind})</span>
              </span>
              <span className="text-xs text-muted">
                {row.at ? formatDateTime(row.at) : "sin confirmar"}
              </span>
            </div>

            <span
              className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                row.amount.startsWith("+") ? "text-success" : "text-foreground"
              }`}
            >
              {row.amount}
            </span>

            {row.hash ? (
              <a
                href={explorerTxUrl(row.hash)}
                target="_blank"
                rel="noreferrer"
                title={row.hash}
                className="shrink-0 font-mono text-xs text-primary transition-colors hover:text-primary-hover"
              >
                {middleTruncate(row.hash, 6, 4)}
              </a>
            ) : (
              <span className="shrink-0 text-xs text-muted-light">sin hash</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Cada hash abre la transacción en stellar.expert. La app no guarda plata:
        todo pasa entre cuentas de Pollar.
      </p>
    </section>
  );
}
