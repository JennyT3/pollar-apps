"use client";

import { useState } from "react";
import Link from "next/link";
import { GoalQR } from "@/components/GoalQR";
import { Input } from "@/components/ui/Input";
import { LoginButton } from "@/components/LoginButton";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { shortAddress } from "@/lib/format";

/**
 * Blocking spike required before the full app: proves the QR-prefilled
 * contribution loop end to end on testnet with two real Pollar accounts.
 *
 * How to reproduce:
 * 1. Log in here with test account A (the "keeper"). This page shows their
 *    address and lets them set an amount + reference, then renders a QR
 *    encoding a deep link to /spike/pay with those prefilled.
 * 2. On a second device/browser, log in with test account B (the
 *    "contributor") and open that link — by scanning the QR or opening the
 *    copied link. See app/spike/pay/page.tsx.
 * 3. Account B pays with one confirmation through the template's PayButton
 *    (no custom signing/submission — same runTx('payment', …) as everywhere
 *    else in the app).
 * 4. Account A's BalanceCard on this page auto-refreshes (it watches the
 *    SDK's global tx state) and the resulting hash is shown on B's screen
 *    with a link to stellar.expert testnet.
 *
 * This does not touch the goals database — it is a self-contained
 * reproduction of the payment loop, independent of the rest of the app.
 */
export default function SpikePage() {
  const { user } = usePollarAuth();
  const [amount, setAmount] = useState("1.00");
  const [ref, setRef] = useState("spike-test");

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Spike: QR contribution loop</h1>
        <p className="text-sm text-muted">
          Iniciá sesión con la cuenta de prueba que va a actuar como <strong>keeper</strong>.
        </p>
        <LoginButton />
      </main>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const amountValid = /^\d+(\.\d{1,7})?$/.test(amount) && Number(amount) > 0;
  const payUrl = `${origin}/spike/pay?to=${user.address}&amount=${encodeURIComponent(amount)}&ref=${encodeURIComponent(ref)}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Spike: QR contribution loop</h1>
      <p className="text-sm leading-6 text-muted">
        Sos el <strong>keeper</strong>: <span className="font-mono">{shortAddress(user.address)}</span>.
        Generá el QR abajo y abrilo con una segunda cuenta (el <strong>contribuyente</strong>) para
        pagar.
      </p>

      <Input
        label="Monto"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(",", "."))}
        className="font-mono"
      />
      <Input label="Referencia" value={ref} onChange={(e) => setRef(e.target.value)} />

      {amountValid && <GoalQR url={payUrl} caption="Escaneá con la cuenta contribuyente para pagar" />}

      <p className="break-all rounded-xl border border-border bg-surface px-4 py-3 text-xs font-mono text-muted">
        {payUrl}
      </p>

      <Link href="/spike/pay" className="text-center text-sm text-primary hover:underline">
        Ir a la pantalla de pago manualmente →
      </Link>
    </main>
  );
}
