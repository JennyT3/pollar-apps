"use client";

import { useState } from "react";
import { PayWithMemo } from "@/components/polla/PayWithMemo";
import { Button } from "@/components/ui/Button";
import { middleTruncate } from "@/lib/format";
import type { PayoutView, PollaView } from "@/lib/queries";
import { explorerTxUrl } from "@/lib/stellar";

/**
 * Closing the polla, and paying the winner.
 *
 * The app never holds the pot and never moves it: it works out who won by the
 * rules the group declared, splits the pot to the stroop, and hands the
 * organizer a payment with the winner and the amount already filled in. The
 * organizer confirms it from their own wallet, and the hash that comes back is
 * recorded and verifiable by anyone in the group.
 */
export function PayoutPanel({
  polla,
  isOrganizer,
  onSettle,
  onPaid,
}: {
  polla: PollaView;
  isOrganizer: boolean;
  onSettle: () => Promise<void>;
  onPaid: (winnerAddress: string, hash: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = polla.matches.filter((match) => match.result === null).length;
  const canSettle =
    isOrganizer &&
    polla.status === "open" &&
    pending === 0 &&
    polla.players.length > 0;

  async function settle() {
    setBusy(true);
    setError(null);
    try {
      await onSettle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar la polla.");
    } finally {
      setBusy(false);
    }
  }

  if (polla.status === "open") {
    if (!isOrganizer) return null;
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
        <h2 className="text-lg font-bold tracking-tight">Cerrar la polla</h2>
        <p className="text-sm leading-6 text-muted">
          Al cerrar, la app calcula el ganador con las reglas declaradas, congela
          el pozo y prepara el pago. Vos lo confirmás desde tu billetera: la app
          nunca mueve tu plata sola.
        </p>
        {pending > 0 && (
          <p className="rounded-xl border border-warning-border bg-warning-light px-4 py-3 text-sm text-warning">
            Faltan {pending} {pending === 1 ? "resultado" : "resultados"} por
            cargar.
          </p>
        )}
        {polla.players.length === 0 && (
          <p className="rounded-xl border border-warning-border bg-warning-light px-4 py-3 text-sm text-warning">
            Todavía nadie pagó su entrada.
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
            {error}
          </p>
        )}
        <Button
          onClick={() => void settle()}
          disabled={!canSettle}
          loading={busy}
          className="w-full py-3"
        >
          Cerrar y calcular ganador
        </Button>
      </section>
    );
  }

  const shared = polla.payouts.length > 1;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">
          {shared ? "Pozo repartido" : "Premio"}
        </h2>
        {shared && (
          <p className="text-sm text-muted">
            Empate arriba: el pozo se divide en partes iguales.
          </p>
        )}
      </header>

      <ul className="flex flex-col gap-3">
        {polla.payouts.map((payout) => (
          <li
            key={payout.winnerAddress}
            className="flex flex-col gap-3 rounded-2xl border border-border p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-semibold">
                {payout.winnerName}
              </span>
              <span className="shrink-0 font-mono text-xl font-semibold tabular-nums">
                {payout.amount}
              </span>
            </div>
            <PayoutStatus payout={payout} />
            {isOrganizer && payout.status === "prepared" && (
              <PayWithMemo
                amount={payout.amount}
                recipient={payout.winnerAddress}
                memoId={payout.memoId}
                label={`Pagar a ${payout.winnerName}`}
                onPaid={(hash) => onPaid(payout.winnerAddress, hash)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PayoutStatus({ payout }: { payout: PayoutView }) {
  if (payout.status === "paid" && payout.txHash) {
    return (
      <a
        href={explorerTxUrl(payout.txHash)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 rounded-xl border border-success-border bg-success-light px-3 py-2 text-sm text-success"
      >
        <span className="font-semibold">Pagado</span>
        <span className="font-mono text-xs">
          {middleTruncate(payout.txHash, 8, 6)}
        </span>
      </a>
    );
  }

  if (payout.status === "kept") {
    return (
      <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
        El ganador es el organizador: el premio ya está en su cuenta, no hay
        transferencia que hacer.
      </p>
    );
  }

  return (
    <p className="rounded-xl border border-warning-border bg-warning-light px-3 py-2 text-sm text-warning">
      Esperando que el organizador confirme el pago.
    </p>
  );
}
