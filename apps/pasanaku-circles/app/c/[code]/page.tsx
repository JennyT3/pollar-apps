"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CircleView } from "@/lib/circles";
import { explorerTxUrl } from "@/lib/horizon";

const labels: Record<string, string> = {
  paid: "Pagó",
  pending: "Debe",
  up_next: "Le toca",
  completed: "Ya cobró",
};

export default function CirclePage() {
  const params = useParams<{ code: string }>();
  const [circle, setCircle] = useState<CircleView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/circles/${params.code}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "no encontrado");
        setCircle(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "error"));
  }, [params.code]);

  if (error) {
    return (
      <AppShell>
        <p className="text-error">{error}</p>
      </AppShell>
    );
  }
  if (!circle) {
    return (
      <AppShell>
        <p className="text-muted">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div>
        <h2 className="text-2xl font-bold">{circle.name}</h2>
        <p className="text-sm text-muted">
          {circle.amount} USDC · {circle.frequency} · ronda {circle.currentRound} de{" "}
          {circle.totalRounds || "?"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/c/${circle.code}/pay`}>
          <Button className="w-full">Pagar ronda</Button>
        </Link>
        <Link href={`/c/${circle.code}/qr`}>
          <Button variant="secondary" className="w-full">
            Ver QR
          </Button>
        </Link>
      </div>
      <Card>
        <h3 className="mb-3 font-semibold">Estado</h3>
        <ul className="flex flex-col gap-2">
          {circle.members.map((member) => (
            <li key={member.address} className="flex items-center justify-between text-sm">
              <span className="truncate font-mono">
                {member.address.slice(0, 6)}…{member.address.slice(-4)}
              </span>
              <span className="text-muted">{labels[member.state]}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">Historial</h3>
        {circle.history.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay pagos.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {circle.history.map((row) => (
              <li key={row.txHash}>
                Ronda {row.round}: {row.amount} USDC{" "}
                <a
                  className="text-primary underline"
                  href={explorerTxUrl(row.txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  ver hash
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Link href={`/c/${circle.code}/join`} className="text-sm text-primary">
        Enlace para unirse
      </Link>
    </AppShell>
  );
}
