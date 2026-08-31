"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ContributeButton } from "@/components/ContributeButton";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { shortAddress } from "@/lib/format";

export default function PayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { user, login } = usePollarAuth();
  const router = useRouter();
  const [prep, setPrep] = useState<{
    memoId: string;
    amount: string;
    recipient: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/circles/${code}/memo?payer=${user.address}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "no se pudo cargar");
        setPrep(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "error"));
  }, [code, user]);

  async function onPaid(hash: string) {
    if (!user) return;
    const res = await fetch(`/api/circles/${code}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hash, payer: user.address }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "no se registró el pago");
    router.push(`/c/${code}`);
  }

  const isRecipient = Boolean(user && prep?.recipient && user.address === prep.recipient);

  return (
    <AppShell>
      <h2 className="text-2xl font-bold">Pagar la ronda</h2>
      {!user ? (
        <ButtonLogin onClick={login} />
      ) : !prep ? (
        <p className="text-muted">Cargando…</p>
      ) : !prep.recipient ? (
        <p className="text-muted">Faltan miembros para abrir la ronda.</p>
      ) : isRecipient ? (
        <p className="text-sm text-muted">
          Esta ronda te toca cobrar. El aporte llega a {shortAddress(prep.recipient)}.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Vas a enviar {prep.amount} USDC a {shortAddress(prep.recipient)}. Un
            toque más.
          </p>
          <ContributeButton
            amount={prep.amount}
            recipient={prep.recipient}
            memoId={prep.memoId}
            onPaid={onPaid}
          />
        </>
      )}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </AppShell>
  );
}

function ButtonLogin({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
    >
      Entrar con Pollar
    </button>
  );
}
