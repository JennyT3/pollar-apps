"use client";

import { useState } from "react";
import { usePollar } from "@pollar/react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useBalance } from "@/hooks/useBalance";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { api } from "@/lib/api";
import { formatAmount, middleTruncate } from "@/lib/format";
import type { Check, VerificationResult } from "@/lib/horizon";
import { currencyOf, looksLikeAddress, paymentAssetFrom } from "@/lib/payments";
import { explorerTxUrl } from "@/lib/stellar";

/**
 * The spike, kept in the app.
 *
 * The blocking criterion of the bounty is the money loop, not the screens: two
 * Pollar accounts, an entry paid by QR and detected, a payout prepared and
 * confirmed, both hashes captured. This page runs exactly that loop with
 * nothing else around it, so it can be repeated by anyone with two test
 * accounts and a browser.
 *
 * It also prints what the SDK's own transaction history returns, because that
 * is the evidence behind the app's detection design: see SPIKE.md and the
 * README section "Cómo se detectan las entradas".
 */
export default function SpikePage() {
  const { user } = usePollarAuth();
  const { asset, balance } = useBalance();
  const currency = currencyOf(paymentAssetFrom(asset));

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Spike: el circuito de la plata
          </h1>
          <p className="text-sm leading-6 text-muted">
            Pago de entrada con referencia, detección contra el ledger, y pago
            del premio con la misma verificación. Sin base de datos y sin polla
            de por medio: solo el movimiento y su comprobante.
          </p>
        </header>

        <section className="flex flex-col gap-2 rounded-2xl border border-border p-5">
          <h2 className="text-base font-bold tracking-tight">Tu cuenta</h2>
          {user ? (
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Dirección</dt>
                <dd className="font-mono" title={user.address}>
                  {middleTruncate(user.address, 8, 8)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Saldo</dt>
                <dd className="font-mono">
                  {formatAmount(balance)} {currency}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted">
              Ingresá con Pollar arriba para usar esta página.
            </p>
          )}
        </section>

        <PaymentProbe
          title="1. Entrada"
          help="Actúa como el jugador: pagá a la cuenta del organizador con una referencia. Es el mismo runTx que usa la app al unirse por QR."
          buttonLabel="Pagar entrada"
          currency={currency}
        />

        <PaymentProbe
          title="2. Premio"
          help="Actúa como el organizador: pagá al ganador el monto del pozo. La app arma este pago prellenado y vos lo confirmás; acá se hace a mano para probar el circuito completo."
          buttonLabel="Pagar premio"
          currency={currency}
        />

        <HistoryProbe />
      </main>
    </>
  );
}

/**
 * One payment, end to end: build it with a reference, submit it through the
 * SDK, then ask the server to check the resulting hash against Horizon.
 */
function PaymentProbe({
  title,
  help,
  buttonLabel,
  currency,
}: {
  title: string;
  help: string;
  buttonLabel: string;
  currency: string;
}) {
  const { runTx } = usePollar();
  const { user } = usePollarAuth();
  const { asset } = useBalance();

  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("1");
  const [memoId, setMemoId] = useState(() => String(Date.now() * 1000));
  const [hash, setHash] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<"paying" | "verifying" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = looksLikeAddress(destination) && /^\d+(\.\d{1,7})?$/.test(amount);

  async function pay() {
    setBusy("paying");
    setError(null);
    setResult(null);
    setHash(null);
    try {
      const outcome = await runTx(
        "payment",
        {
          destination: destination.trim(),
          amount,
          asset: paymentAssetFrom(asset),
        },
        { memo: { type: "id", value: memoId } }
      );

      if (outcome.status === "error") {
        setError(outcome.message ?? outcome.details ?? "El pago falló.");
        return;
      }

      setHash(outcome.hash);
      setBusy("verifying");
      setResult(
        await api<VerificationResult>("/api/spike/verify", {
          method: "POST",
          json: {
            hash: outcome.hash,
            destination: destination.trim(),
            source: user?.address,
            amount,
            memoId,
          },
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        <p className="text-sm leading-6 text-muted">{help}</p>
      </div>

      <Input
        label="Cuenta destino"
        placeholder="G…"
        value={destination}
        onChange={(event) => setDestination(event.target.value)}
        className="font-mono"
        error={
          destination && !looksLikeAddress(destination)
            ? "Una dirección de Pollar empieza con G y tiene 56 caracteres."
            : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={`Monto (${currency})`}
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(",", "."))}
          className="font-mono"
        />
        <Input
          label="Referencia (MEMO_ID)"
          inputMode="numeric"
          value={memoId}
          onChange={(event) => setMemoId(event.target.value.replace(/\D/g, ""))}
          className="font-mono"
        />
      </div>

      <Button
        onClick={() => void pay()}
        disabled={!ready || !user}
        loading={busy !== null}
        className="w-full py-3"
      >
        {busy === "paying"
          ? "Pagando…"
          : busy === "verifying"
            ? "Verificando en Horizon…"
            : buttonLabel}
      </Button>

      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      {hash && (
        <a
          href={explorerTxUrl(hash)}
          target="_blank"
          rel="noreferrer"
          className="break-all rounded-xl border border-border bg-surface px-4 py-3 text-center font-mono text-xs leading-5 text-primary"
        >
          {hash}
        </a>
      )}

      {result && <Checks result={result} />}
    </section>
  );
}

function Checks({ result }: { result: VerificationResult }) {
  if (result.error) {
    return (
      <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
        {result.error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        className={`rounded-xl px-4 py-3 text-sm font-semibold ${
          result.ok
            ? "border border-success-border bg-success-light text-success"
            : "border border-error-border bg-error-light text-error"
        }`}
      >
        {result.ok
          ? "El ledger confirma el pago: la app lo daría por bueno."
          : "El ledger no respalda este pago: la app lo rechazaría."}
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {result.checks.map((check: Check) => (
          <li key={check.id} className="flex flex-col gap-1 px-4 py-3">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{check.label}</span>
              <span
                className={`shrink-0 text-xs font-bold uppercase ${
                  check.ok ? "text-success" : "text-error"
                }`}
              >
                {check.ok ? "ok" : "falla"}
              </span>
            </span>
            {!check.ok && (
              <span className="break-all font-mono text-xs text-muted">
                esperado {check.expected} · recibido {check.actual}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What `fetchTxHistory` actually returns, printed raw.
 *
 * The app detects incoming entries against Horizon rather than the SDK's
 * history, and this is the check behind that decision: the records here belong
 * to the logged-in account and carry no counterparty and no memo, so they
 * cannot say which player settled which entry.
 */
function HistoryProbe() {
  const { getClient, txHistory } = usePollar();
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      await getClient().fetchTxHistory({ limit: 5 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold tracking-tight">
          3. Qué devuelve el historial del SDK
        </h2>
        <p className="text-sm leading-6 text-muted">
          La detección de entradas no se apoya acá, y esta es la prueba: los
          registros son de la cuenta que inició sesión y no traen contraparte ni
          memo, así que no alcanzan para decir qué pago corresponde a qué
          jugador.
        </p>
      </div>

      <Button onClick={() => void load()} loading={busy} variant="secondary">
        Traer mis últimas 5 transacciones
      </Button>

      {txHistory.step === "error" && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {txHistory.message}
        </p>
      )}

      {txHistory.step === "loaded" && (
        <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-5">
          {JSON.stringify(txHistory.data.records, null, 2)}
        </pre>
      )}
    </section>
  );
}
