"use client";

import { useState } from "react";
import { usePollar } from "@pollar/react";
import { Button } from "@/components/ui/Button";
import { useBalance } from "@/hooks/useBalance";
import { formatAmount, middleTruncate } from "@/lib/format";
import { currencyOf, paymentAssetFrom } from "@/lib/payments";
import { toStroops } from "@/lib/stellar";

/**
 * One confirmation, one payment, carrying a reference.
 *
 * Built on `runTx('payment', …)`, the same SDK call behind the template's
 * `PayButton` and `SendModal`, with one addition the polla needs: a MEMO_ID.
 * Without it an incoming payment is just money arriving in the organizer's
 * account, and the app cannot say which player it belongs to. `PayButton`
 * takes no memo, so this component wraps the same call rather than
 * reimplementing anything underneath it.
 *
 * Used for both directions of the pot: a player paying their entry, and the
 * organizer paying a winner.
 */
export function PayWithMemo({
  amount,
  recipient,
  memoId,
  label,
  onPaid,
  disabled,
}: {
  amount: string;
  recipient: string;
  memoId: number;
  label: string;
  /** Fires for confirmed and network-accepted payments alike. */
  onPaid: (hash: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const { isAuthenticated, verified, runTx } = usePollar();
  const { asset, balance } = useBalance();
  const [step, setStep] = useState<
    "idle" | "confirming" | "processing" | "reporting"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const payAsset = paymentAssetFrom(asset);
  const currency = currencyOf(payAsset);
  const short = `${recipient.slice(0, 4)}…${recipient.slice(-4)}`;

  let notEnough = false;
  try {
    notEnough = balance !== null && toStroops(balance) < toStroops(amount);
  } catch {
    notEnough = false;
  }

  async function pay() {
    setStep("processing");
    setError(null);
    try {
      const result = await runTx(
        "payment",
        { destination: recipient, amount, asset: payAsset },
        { memo: { type: "id", value: String(memoId) } }
      );

      if (result.status === "error") {
        setError(
          result.message ??
            result.details ??
            "El pago no salió. Revisá tu saldo y volvé a intentar."
        );
        setStep("idle");
        return;
      }

      // The money is on its way; the app still has to be told, and the server
      // checks the hash against the ledger before it counts.
      setStep("reporting");
      await onPaid(result.hash);
      setStep("idle");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "El pago no salió. Revisá tu conexión y volvé a intentar."
      );
      setStep("idle");
    }
  }

  if (step === "confirming") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted">Vas a pagar</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {amount} {currency}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>A la cuenta</span>
          <span className="font-mono" title={recipient}>
            {short}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>Referencia</span>
          <span className="font-mono">{memoId}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void pay()} className="flex-1 py-3">
            Confirmar
          </Button>
          <Button variant="secondary" onClick={() => setStep("idle")}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  const working = step === "processing" || step === "reporting";

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => setStep("confirming")}
        disabled={disabled || !isAuthenticated || !verified || notEnough}
        loading={working}
        className="w-full py-3"
      >
        {step === "processing"
          ? "Pagando…"
          : step === "reporting"
            ? "Registrando…"
            : label}
      </Button>

      {notEnough && (
        <p className="text-sm text-warning">
          Tu saldo es {formatAmount(balance)} {currency} y la entrada cuesta{" "}
          <span className="font-mono">{amount}</span>. Cargá saldo y volvé.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {!isAuthenticated && (
        <p className="text-sm text-muted">
          Iniciá sesión con Pollar para pagar a {middleTruncate(recipient, 4, 4)}.
        </p>
      )}
    </div>
  );
}
