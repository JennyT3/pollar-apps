"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PayButton, type PaymentResult } from "@/components/PayButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoginButton } from "@/components/LoginButton";
import { looksLikeAddress } from "@/lib/payments";
import { explorerTxUrl } from "@/lib/horizon";
import { shortAddress } from "@/lib/format";
import { usePollarAuth } from "@/hooks/usePollarAuth";

function PayContent() {
  const params = useSearchParams();
  const { user } = usePollarAuth();
  const to = params.get("to") ?? "";
  const amount = params.get("amount") ?? "";
  const ref = params.get("ref") ?? "";
  const [result, setResult] = useState<PaymentResult | null>(null);

  if (!to || !looksLikeAddress(to) || !amount) {
    return (
      <EmptyState
        title="Falta el link de pago"
        description="Este link debería venir del QR generado en /spike. Pedí que te lo reenvíen."
      />
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted">
          Iniciá sesión con la cuenta <strong>contribuyente</strong> (distinta a la del keeper) para
          pagar.
        </p>
        <LoginButton />
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <EmptyState
          title="¡Pago confirmado!"
          description={`${amount} le llegaron a ${shortAddress(to)}. El balance del keeper ya está actualizado en su pantalla.`}
        />
        <p className="rounded-xl border border-border bg-surface px-4 py-3 font-mono text-xs break-all">
          {result.hash}
        </p>
        <a
          href={explorerTxUrl(result.hash)}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Ver en stellar.expert (testnet) ↗
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <p className="text-sm text-muted">Vas a pagar a</p>
        <p className="font-mono text-sm font-semibold">{shortAddress(to)}</p>
        {ref && <p className="mt-1 text-xs text-muted-light">Referencia: {ref}</p>}
      </div>
      <PayButton amount={amount} recipient={to} label={`Pagar ${amount}`} onSuccess={setResult} />
    </div>
  );
}

export default function SpikePayPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Suspense>
        <PayContent />
      </Suspense>
    </main>
  );
}
