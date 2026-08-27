"use client";

import { useState } from "react";
import { usePollar } from "@pollar/react";
import { Button } from "./ui/Button";
import { useBalance } from "../hooks/useBalance";
import { currencyOf, paymentAssetFrom } from "../lib/payments";

interface ContributeButtonProps {
  poolId: string;
  organizerAddress: string;
  amount: string;
  maxAllowed?: number;
  onSuccess: (result: { hash: string; status: string }) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

type Step = "idle" | "confirming" | "processing" | "success" | "error";

export function ContributeButton({
  poolId,
  organizerAddress,
  amount,
  maxAllowed,
  onSuccess,
  onError,
  disabled,
}: ContributeButtonProps) {
  const { isAuthenticated, verified, runTx } = usePollar();
  const { balance, asset } = useBalance();
  const [step, setStep] = useState<Step>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const payAsset = paymentAssetFrom(asset);
  const currency = currencyOf(payAsset);

  const amountNumber = Number(amount);
  const overBalance = balance !== null && amountNumber > Number(balance);
  const overMax = maxAllowed !== undefined && amountNumber > maxAllowed;

  async function pay() {
    setStep("processing");
    try {
      const result = await runTx(
        "payment",
        { destination: organizerAddress, amount, asset: payAsset },
        { memo: { type: "text", value: poolId } }
      );

      if (result.status === "error") {
        const msg = result.message ?? result.details ?? "El pago falló.";
        setErrorMessage(msg);
        setStep("error");
        onError?.(msg);
        return;
      }

      setStep("success");
      if (result.hash) {
        onSuccess({ hash: result.hash, status: result.status });
      } else {
        const msg = "Pago enviado pero sin hash devuelto.";
        setErrorMessage(msg);
        setStep("error");
        onError?.(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión.";
      setErrorMessage(msg);
      setStep("error");
      onError?.(msg);
    }
  }

  if (step === "confirming") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-sm text-gray-700 text-center">
          ¿Confirmar contribución de <span className="font-mono font-semibold">{amount} {currency}</span>?
        </span>
        <div className="flex gap-2">
          <Button onClick={() => void pay()} className="flex-1 py-2">
            Confirmar
          </Button>
          <Button variant="secondary" onClick={() => setStep("idle")} className="flex-1 py-2">
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
        <span className="text-sm font-medium text-green-700">
          Contribución enviada
        </span>
      </div>
    );
  }

  let buttonText = `Contribuir ${amount || '0'} ${currency}`;
  if (!isAuthenticated) buttonText = "Inicia sesión para contribuir";
  if (step === "processing") buttonText = "Procesando...";

  return (
    <div className="flex flex-col gap-2 w-full">
      <Button
        onClick={() => setStep("confirming")}
        disabled={disabled || !isAuthenticated || !verified || overBalance || overMax || step === "processing" || amountNumber <= 0 || isNaN(amountNumber)}
        loading={step === "processing"}
        className="w-full"
      >
        {buttonText}
      </Button>
      {overBalance && (
        <p className="text-sm text-red-500 text-center">
          Saldo insuficiente ({Number(balance).toFixed(2)} {currency} disponibles)
        </p>
      )}
      {overMax && (
        <p className="text-sm text-red-500 text-center">
          El monto excede el máximo permitido ({maxAllowed} {currency})
        </p>
      )}
      {step === "error" && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
