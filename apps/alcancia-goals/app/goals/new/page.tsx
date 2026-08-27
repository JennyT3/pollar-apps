"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmojiPicker } from "@/components/EmojiPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useBalance } from "@/hooks/useBalance";
import { createGoal } from "@/lib/api";

type Mode = "personal" | "shared";

export default function NewGoalPage() {
  const router = useRouter();
  const { user } = usePollarAuth();
  const { currency } = useBalance();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🐷");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [mode, setMode] = useState<Mode>("personal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted">
        Iniciá sesión para crear una meta.
      </main>
    );
  }

  const amountValid = /^\d+(\.\d{1,7})?$/.test(targetAmount) && Number(targetAmount) > 0;
  const valid = name.trim().length > 0 && amountValid;

  async function submit() {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createGoal({
        name: name.trim(),
        emoji,
        targetAmount,
        deadline: deadline || null,
        mode,
        currency: currency ?? "USDC",
        ownerAddress: user.address,
      });
      router.push(`/goals/${res.goal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear la meta, probá de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 lg:max-w-lg lg:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Nueva meta</h1>

      <Input
        label="Nombre"
        placeholder="La bici, el viaje, diciembre…"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Emoji</span>
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>

      <Input
        label={`Meta (${currency ?? "USDC"})`}
        placeholder="500"
        inputMode="decimal"
        value={targetAmount}
        onChange={(e) => setTargetAmount(e.target.value.replace(",", "."))}
        className="font-mono"
      />

      <Input
        label="Fecha límite (opcional)"
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Modo</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("personal")}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              mode === "personal" ? "border-primary bg-primary-light" : "border-border bg-background"
            }`}
          >
            <p className="text-sm font-semibold">Personal</p>
            <p className="text-xs text-muted">Apartás de tu propio balance</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("shared")}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              mode === "shared" ? "border-primary bg-primary-light" : "border-border bg-background"
            }`}
          >
            <p className="text-sm font-semibold">Compartida</p>
            <p className="text-xs text-muted">Otros aportan por QR a tu cuenta</p>
          </button>
        </div>
        {mode === "shared" && (
          <p className="text-xs leading-5 text-muted-light">
            Vos sos el keeper: los pagos de los demás miembros llegan directo a tu balance de
            Pollar.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <Button onClick={() => void submit()} disabled={!valid} loading={submitting} className="w-full py-3">
        Crear meta
      </Button>
    </main>
  );
}
