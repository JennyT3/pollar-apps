"use client";

import { useState } from "react";
import { PayButton, type PaymentResult } from "@/components/PayButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBalance } from "@/hooks/useBalance";
import { formatAmount } from "@/lib/format";
import { recordContribution } from "@/lib/api";
import { usdcAssetFrom } from "@/lib/payments";
import { compareAmounts } from "@/lib/decimal";

/**
 * Amount → PayButton, for a shared goal's keeper. The actual payment runs
 * entirely through the template's PayButton (`runTx('payment', …)`); this
 * component's only extra job is persisting the resulting hash against the
 * goal once the SDK confirms it.
 */
export function ContributeFlow({
  goalId,
  keeperAddress,
  currency,
  remaining,
  onContributed,
}: {
  goalId: string;
  keeperAddress: string;
  currency: string;
  /** How much is left to reach the target — the amount can't exceed this. */
  remaining: string;
  onContributed: (saved: string) => void;
}) {
  const { balance, asset } = useBalance();
  const [amount, setAmount] = useState(remaining);
  const [done, setDone] = useState<PaymentResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const payAsset = usdcAssetFrom(asset);
  const hasNoUsdc = asset !== null && !payAsset;

  const amountNumber = Number(amount);
  const exceedsRemaining = /^\d+(\.\d{1,7})?$/.test(amount) && compareAmounts(amount, remaining) > 0;
  const valid =
    /^\d+(\.\d{1,7})?$/.test(amount) &&
    amountNumber > 0 &&
    !exceedsRemaining &&
    payAsset !== null &&
    (balance === null || amountNumber <= Number(balance));

  async function onSuccess(result: PaymentResult) {
    setDone(result);
    try {
      const res = await recordContribution(goalId, amount, result.hash);
      onContributed(res.saved);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "El pago se hizo pero no pudimos guardarlo en el historial. Refrescá la página."
      );
    }
  }

  if (done) {
    return (
      <EmptyState
        title="¡Contribución hecha!"
        description={
          saveError ??
          `${amount} ${currency} llegaron al keeper. Tu balance ya está actualizado.`
        }
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
        Monto en {currency}
      </span>
      <input
        autoFocus
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(",", "."))}
        className="w-full bg-transparent text-center font-mono text-6xl font-semibold tabular-nums tracking-tight outline-none placeholder:text-muted-light"
      />
      <span className="text-sm text-muted">
        Balance: <span className="font-mono">{formatAmount(balance)} {currency}</span>
      </span>
      {hasNoUsdc && (
        <p className="text-center text-sm text-error">
          Tu cuenta no tiene USDC en testnet. Necesitás fondos en USDC para contribuir.
        </p>
      )}
      {exceedsRemaining && (
        <p className="text-center text-sm text-error">
          Solo faltan {formatAmount(remaining)} {currency} para completar la meta.
        </p>
      )}
      {valid && payAsset && (
        <PayButton
          amount={amount}
          recipient={keeperAddress}
          asset={payAsset}
          memo={goalId}
          label={`Contribuir ${amount} ${currency}`}
          onSuccess={(r) => void onSuccess(r)}
        />
      )}
    </div>
  );
}
