"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { setAside } from "@/lib/api";

export function SetAsideModal({
  open,
  onClose,
  goalId,
  address,
  currency,
  type,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  goalId: string;
  address: string;
  currency: string;
  type: "add" | "withdraw";
  onDone: (saved: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNumber = Number(amount);
  const valid = /^\d+(\.\d{1,7})?$/.test(amount) && amountNumber > 0;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await setAside(goalId, address, amount, type);
      onDone(res.saved);
      setAmount("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal, probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setAmount("");
        setError(null);
        onClose();
      }}
      title={type === "add" ? "Apartar plata" : "Retirar de la meta"}
    >
      <div className="flex flex-col items-center gap-6 py-4">
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
        {error && (
          <p className="w-full rounded-xl border border-error-border bg-error-light px-4 py-3 text-center text-sm text-error">
            {error}
          </p>
        )}
        <Button onClick={() => void submit()} disabled={!valid} loading={submitting} className="w-full py-3">
          {type === "add" ? "Apartar" : "Retirar"}
        </Button>
        {type === "add" && (
          <p className="text-center text-xs leading-5 text-muted-light">
            Esto no mueve tu plata a ningún lado: solo anota cuánto de tu balance está reservado
            para esta meta.
          </p>
        )}
      </div>
    </Modal>
  );
}
