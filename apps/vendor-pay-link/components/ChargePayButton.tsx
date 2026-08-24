"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { usePollar } from "@pollar/react";
import { Button } from "@/components/ui/Button";
import { useBalance } from "@/hooks/useBalance";
import { formatMoney } from "@/lib/format";
import { paymentAssetFrom, type PaymentResult } from "@/lib/payments";

/**
 * Pago con una confirmación. Bloquea doble tap y reclama el cobro en el
 * servidor antes de enviar, para que dos pestañas no paguen el mismo QR.
 */
export function ChargePayButton({
  amount,
  recipient,
  memo,
  saleId,
  label,
  onSuccess,
}: {
  amount: string;
  recipient: string;
  memo: string;
  saleId: string;
  label?: string;
  onSuccess?: (result: PaymentResult) => void;
}) {
  const { isAuthenticated, verified, runTx } = usePollar();
  const { asset: appAsset } = useBalance();
  const [step, setStep] = useState<
    | { step: "idle" }
    | { step: "confirming" }
    | { step: "processing" }
    | { step: "success" }
    | { step: "error"; message: string }
  >({ step: "idle" });
  const started = useRef(false);

  const payAsset = paymentAssetFrom(appAsset);

  async function pay() {
    if (started.current) return;
    started.current = true;
    setStep({ step: "processing" });
    try {
      const claim = await fetch(`/api/sales/${saleId}/claim`, {
        method: "POST",
      });
      if (claim.status === 409) {
        const data = (await claim.json()) as { code?: string; error?: string };
        if (data.code === "already_paid") {
          setStep({ step: "success" });
          onSuccess?.({ status: "success", hash: "" } as PaymentResult);
          return;
        }
        setStep({
          step: "error",
          message:
            "Este pago ya está en curso. No lo envíes de nuevo.",
        });
        return;
      }
      if (!claim.ok) {
        started.current = false;
        setStep({
          step: "error",
          message: "No se pudo iniciar el pago. Prueba de nuevo.",
        });
        return;
      }

      const result = await runTx(
        "payment",
        { destination: recipient, amount, asset: payAsset },
        memo ? { memo: { type: "text", value: memo.slice(0, 28) } } : undefined
      );
      if (result.status === "error") {
        started.current = false;
        await fetch(`/api/sales/${saleId}/release`, { method: "POST" });
        setStep({
          step: "error",
          message:
            result.message ??
            result.details ??
            "El pago no pasó. Revisa el monto y tu saldo.",
        });
        return;
      }
      await fetch(`/api/sales/${saleId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: result.hash }),
      });
      setStep({ step: "success" });
      onSuccess?.(result);
    } catch (err) {
      started.current = false;
      await fetch(`/api/sales/${saleId}/release`, { method: "POST" });
      setStep({
        step: "error",
        message:
          err instanceof Error
            ? err.message
            : "El pago no pasó. Prueba de nuevo.",
      });
    }
  }

  if (step.step === "confirming") {
    return (
      <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-4">
        <p className="text-sm text-muted">
          ¿Pagar{" "}
          <span className="font-semibold text-foreground">
            {formatMoney(amount)} USD
          </span>
          ?
        </p>
        <div className="flex gap-2">
          <Button onClick={() => void pay()} className="flex-1">
            Confirmar
          </Button>
          <Button
            variant="secondary"
            onClick={() => setStep({ step: "idle" })}
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (step.step === "success") {
    return (
      <div className="w-full rounded-2xl border border-success-border bg-success-light px-4 py-4 text-center">
        <p className="text-sm font-medium text-success">
          Listo. Pagaste {formatMoney(amount)} USD
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        onClick={() => setStep({ step: "confirming" })}
        disabled={!isAuthenticated || !verified || started.current}
        loading={step.step === "processing"}
        className="w-full py-3"
      >
        {!isAuthenticated
          ? "Inicia sesión para pagar"
          : step.step === "processing"
            ? "Procesando…"
            : (label ?? `Pagar ${formatMoney(amount)} USD`)}
      </Button>
      {step.step === "error" && (
        <p className="rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
          {step.message}
        </p>
      )}
    </div>
  );
}

/** Confirm a sale on our API after a successful Pollar payment. */
export function useConfirmSale() {
  const [confirming, setConfirming] = useState(false);

  async function confirm(saleId: string, txHash: string) {
    setConfirming(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      return res.ok;
    } finally {
      setConfirming(false);
    }
  }

  return { confirm, confirming };
}

/** Absolute origin for QR links (browser only). */
export function useAppOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
}
