"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePollarAuth } from "@/hooks/usePollarAuth";

export default function NewCirclePage() {
  const { user, login } = usePollarAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("10");
  const [frequency, setFrequency] = useState("weekly");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      login();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          amount,
          frequency,
          organizerAddress: user.address,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "no se pudo crear");
      router.push(`/c/${body.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h2 className="text-2xl font-bold">Crear círculo</h2>
      <p className="text-sm text-muted">
        En este dispositivo vas a poder sortear o reordenar los turnos mientras
        el círculo esté abierto.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-sm font-medium">
          Nombre
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-sm font-medium">
          Aporte (USDC)
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Frecuencia
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          >
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
          </select>
        </label>
        <Button type="submit" loading={busy}>
          Crear
        </Button>
        {error ? <p className="text-sm text-error">{error}</p> : null}
      </form>
    </AppShell>
  );
}
