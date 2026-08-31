"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ContributeButton } from "@/components/ContributeButton";
import { Input } from "@/components/ui/Input";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { explorerTxUrl } from "@/lib/horizon";

function SpikeInner() {
  const { user } = usePollarAuth();
  const params = useSearchParams();
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const [recipient, setRecipient] = useState(params.get("to") ?? "");
  const [amount, setAmount] = useState(params.get("amount") ?? "1");
  const [hash, setHash] = useState<string | null>(null);
  const payUrl = origin
    ? `${origin}/spike?to=${encodeURIComponent(recipient)}&amount=${encodeURIComponent(amount)}`
    : "";

  return (
    <AppShell>
      <h2 className="text-2xl font-bold">Spike de pago QR</h2>
      <p className="text-sm text-muted">
        Dos cuentas Pollar. Esta página arma un QR con destinatario y monto.
        Escanealo o abrilo, confirmá, y queda el hash.
      </p>
      <Input
        label="Destinatario (G…)"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value.trim())}
      />
      <Input
        label="Monto"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {origin && recipient ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="QR de pago"
            src={`/api/qr?u=${encodeURIComponent(payUrl)}`}
            className="mx-auto w-56"
          />
          <p className="break-all text-xs text-muted">{payUrl}</p>
        </>
      ) : null}
      {user && recipient ? (
        <ContributeButton
          amount={amount}
          recipient={recipient}
          memoId="1"
          onPaid={async (paidHash) => setHash(paidHash)}
        />
      ) : (
        <p className="text-sm text-muted">Entrá con Pollar para pagar.</p>
      )}
      {hash ? (
        <a className="text-sm text-primary underline" href={explorerTxUrl(hash)}>
          Ver en el explorer
        </a>
      ) : null}
    </AppShell>
  );
}

export default function SpikePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="text-muted">Cargando…</p>
        </AppShell>
      }
    >
      <SpikeInner />
    </Suspense>
  );
}
