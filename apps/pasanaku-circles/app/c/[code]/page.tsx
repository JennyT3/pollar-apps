"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TurnOrderEditor } from "@/components/TurnOrderEditor";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import type { CircleView } from "@/lib/circles";
import { shortAddress } from "@/lib/format";
import { explorerTxUrl } from "@/lib/horizon";

const labels: Record<string, string> = {
  paid: "Pagó",
  pending: "Debe",
  up_next: "Le toca",
  completed: "Ya cobró",
};

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function CirclePage() {
  const params = useParams<{ code: string }>();
  const { user } = usePollarAuth();
  const [circle, setCircle] = useState<CircleView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/circles/${params.code}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "no encontrado");
        setCircle(body);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "error"));
  }, [params.code]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    const id = window.setInterval(load, 8000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

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

  const isOrganizer = user?.address === circle.organizerAddress;
  const canManageTurns = Boolean(circle.canManageTurns) || isOrganizer;
  const closed = circle.status === "completed";

  return (
    <AppShell>
      <div>
        <h2 className="text-2xl font-bold">{circle.name}</h2>
        <p className="text-sm text-muted">
          {circle.amount} USDC · {circle.frequency} ·{" "}
          {closed
            ? "círculo cerrado"
            : `ronda ${circle.currentRound} de ${circle.totalRounds || "?"}`}
        </p>
      </div>
      {closed ? (
        <Card>
          <p className="text-sm font-medium text-success">
            Círculo cerrado. Todos cobraron su ronda.
          </p>
        </Card>
      ) : (
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
      )}
      <Card>
        <h3 className="mb-3 font-semibold">Estado</h3>
        <ul className="flex flex-col gap-2">
          {circle.members.map((member) => (
            <li key={member.address} className="flex items-center justify-between text-sm">
              <span className="truncate font-mono">
                {shortAddress(member.address)}
              </span>
              <span className="text-muted">{labels[member.state]}</span>
            </li>
          ))}
        </ul>
      </Card>
      {canManageTurns && circle.status === "open" ? (
        <Card>
          <h3 className="mb-3 font-semibold">Orden de turnos</h3>
          <TurnOrderEditor
            code={circle.code}
            members={circle.members}
            onChanged={load}
          />
        </Card>
      ) : null}
      <Card>
        <h3 className="mb-3 font-semibold">Historial</h3>
        {circle.history.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay pagos.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {circle.history.map((row) => (
              <li key={row.txHash} className="flex flex-col gap-0.5">
                <span>
                  Ronda {row.round}: {row.amount} USDC
                </span>
                <span className="text-muted">
                  {formatWhen(row.createdAt)} · paga {shortAddress(row.payer)} ·
                  cobra {shortAddress(row.recipient)}
                </span>
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
      {circle.status === "open" ? (
        <Link href={`/c/${circle.code}/join`} className="text-sm text-primary">
          Enlace para unirse
        </Link>
      ) : null}
    </AppShell>
  );
}
