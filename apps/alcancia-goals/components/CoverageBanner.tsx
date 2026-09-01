"use client";

import { useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import { useBalance } from "@/hooks/useBalance";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount } from "@/lib/format";
import { getCoverage } from "@/lib/api";
import { compareAmounts, subtractAmounts } from "@/lib/decimal";

/**
 * The honest substitute for custody: Pollar has no way to freeze a balance,
 * so a personal alcancía is just a claim over the user's real, spendable
 * balance. This compares that real balance (from the SDK, live) against the
 * sum of set-asides across every active personal goal (from our own DB) and
 * warns when the real balance can no longer cover what's been set aside —
 * e.g. because the user spent from the same balance in another Pollar app.
 */
export function CoverageBanner() {
  const { user } = usePollarAuth();
  const { balance, currency, isLoading: balanceLoading } = useBalance();
  const { tx } = usePollar();
  const [committed, setCommitted] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void getCoverage(user.address).then((r) => setCommitted(r.committed));
  }, [user, tx.step]);

  if (!user || balanceLoading || balance === null || committed === null) return null;

  const broken = compareAmounts(balance, committed) < 0;
  if (!broken) return null;

  const shortfall = subtractAmounts(committed, balance);

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-warning-border bg-warning-light px-4 py-3">
      <p className="text-sm font-semibold text-warning">
        Tu alcancía está rota — te faltan {formatAmount(shortfall)} {currency}
      </p>
      <p className="text-sm leading-6 text-warning">
        Tenés {formatAmount(committed)} {currency} apartados entre tus metas personales, pero tu
        balance real es {formatAmount(balance)} {currency}. Probablemente gastaste desde otra app
        de Pollar — tu balance es uno solo en todas partes.
      </p>
    </div>
  );
}
