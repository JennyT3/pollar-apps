"use client";

import { useEffect, useState } from "react";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { formatAmount } from "@/lib/format";
import { formatDateTime, relativeTo } from "@/lib/time";

/**
 * The pot, and the clock.
 *
 * The two numbers that decide everything else: how much is on the table, and
 * how long is left to predict. The pot is entry × entries paid, never an
 * estimate, never counting somebody who has not paid yet.
 */
export function PotCard({
  amount,
  currency,
  players,
  entryAmount,
  deadlineAt,
  locked,
  settled,
}: {
  amount: string;
  currency: string;
  players: number;
  entryAmount: string;
  deadlineAt: number;
  locked: boolean;
  settled: boolean;
}) {
  // The countdown ticks in the browser, but whether predictions are actually
  // frozen is the server's call: this only refreshes the wording.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (locked) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [locked]);

  return (
    <section className="relative w-full overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-md">
      <div className="pointer-events-none absolute -right-4 -bottom-6">
        <PollarLogo size={120} colorClass="bg-primary-foreground/10" />
      </div>

      <span className="text-sm font-medium text-primary-foreground/75">
        {settled ? "Pozo repartido" : "Pozo"}
      </span>

      <p className="mt-2 font-mono text-5xl font-semibold tabular-nums tracking-tight">
        {formatAmount(amount)}
        <span className="ml-2 text-lg font-normal text-primary-foreground/75">
          {currency}
        </span>
      </p>

      <p className="mt-1 text-sm text-primary-foreground/75">
        {players} {players === 1 ? "jugador" : "jugadores"} ·{" "}
        <span className="font-mono">{entryAmount}</span> {currency} por entrada
      </p>

      <p className="mt-4 border-t border-primary-foreground/20 pt-3 text-sm text-primary-foreground/90">
        {settled ? (
          <>Polla cerrada. El pozo ya tiene dueño.</>
        ) : locked ? (
          <>Pronósticos cerrados desde el {formatDateTime(deadlineAt)}.</>
        ) : (
          <>
            Cierran {relativeTo(deadlineAt, now)} · {formatDateTime(deadlineAt)}
          </>
        )}
      </p>
    </section>
  );
}
