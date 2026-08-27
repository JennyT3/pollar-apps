"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { shortAddress } from "@/lib/format";

export function TurnOrderEditor({
  code,
  members,
  onChanged,
}: {
  code: string;
  members: { address: string; turnIndex: number }[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordered = [...members].sort((a, b) => a.turnIndex - b.turnIndex);

  async function post(body: { shuffle?: boolean; order?: string[] }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${code}/turns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error === "not authorized"
            ? "sorteá el orden desde el dispositivo donde creaste el círculo"
            : (json.error ?? "no se pudo cambiar el orden")
        );
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo cambiar el orden");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const next = ordered.map((m) => m.address);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void post({ order: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Orden de turnos. Podés sortearlo o mover a cada miembro mientras el
        círculo está abierto.
      </p>
      <ul className="flex flex-col gap-2">
        {ordered.map((member, index) => (
          <li
            key={member.address}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="font-mono">
              {index + 1}. {shortAddress(member.address)}
            </span>
            <span className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
                className="px-2 py-1"
              >
                Subir
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || index === ordered.length - 1}
                onClick={() => move(index, 1)}
                className="px-2 py-1"
              >
                Bajar
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        loading={busy}
        onClick={() => post({ shuffle: true })}
      >
        Sortear turnos
      </Button>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
