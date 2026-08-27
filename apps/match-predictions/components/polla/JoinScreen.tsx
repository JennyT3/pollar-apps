"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PayWithMemo } from "@/components/polla/PayWithMemo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppSession } from "@/hooks/useAppSession";
import { useBalance } from "@/hooks/useBalance";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { api } from "@/lib/api";
import { middleTruncate } from "@/lib/format";
import type { PollaView } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";

interface Reservation {
  entry: { id: string; memoId: number; amount: string; paid: boolean };
  destination: string;
}

/** How often to ask the server to sweep while waiting for a payment to land. */
const WAIT_MS = 5000;

/**
 * Where the QR lands you.
 *
 * The whole point of this screen is that nobody types a `G…` address. Scanning
 * the code opens the polla with the organizer's account and the entry amount
 * already in place; the player puts in the name the group will see and confirms
 * one payment. That payment carries a reference, and only when the ledger shows
 * it are they in.
 *
 * If the confirmation never reaches the server (a tab closed on the "sending"
 * screen, a phone that lost signal), this screen keeps asking the server to
 * look at the organizer's account until the payment turns up on its own.
 */
export function JoinScreen({ initial }: { initial: PollaView }) {
  const { user, login } = usePollarAuth();
  const { currency } = useBalance();
  const { ensure, busy: signing, error: sessionError } = useAppSession();

  const [polla, setPolla] = useState(initial);
  const [name, setName] = useState("");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const paid = Boolean(polla.viewer.entry?.paid);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ polla: PollaView }>(`/api/pollas/${polla.code}/sync`, {
        method: "POST",
      });
      setPolla(res.polla);
      return res.polla;
    } catch {
      return null;
    }
  }, [polla.code]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const fresh = await refresh();
      // A returning player already has their entry; show it instead of asking
      // them to reserve a place they already hold.
      if (fresh?.viewer.entry && !fresh.viewer.entry.paid) {
        setReservation({
          entry: {
            id: fresh.viewer.entry.id,
            memoId: fresh.viewer.entry.memoId,
            amount: fresh.viewer.entry.amount,
            paid: false,
          },
          destination: fresh.organizer.address,
        });
      }
    })();
  }, [user, refresh]);

  // Keep looking while a payment is in flight but not yet recorded.
  useEffect(() => {
    if (!waiting || paid) return;
    const timer = setInterval(() => void refresh(), WAIT_MS);
    return () => clearInterval(timer);
  }, [waiting, paid, refresh]);

  async function reserve() {
    setBusy(true);
    setError(null);
    try {
      await ensure();
      const res = await api<Reservation>(`/api/pollas/${polla.code}/entries`, {
        method: "POST",
        json: { name: name.trim() },
      });
      setReservation(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reservar tu lugar.");
    } finally {
      setBusy(false);
    }
  }

  async function report(hash: string) {
    setWaiting(true);
    setError(null);
    try {
      await api(`/api/pollas/${polla.code}/entries/confirm`, {
        method: "POST",
        json: { hash },
      });
    } catch (err) {
      // The payment may still be perfectly good and simply not indexed yet;
      // the sweep will find it. Say so instead of alarming the player.
      setError(
        err instanceof Error
          ? `${err.message} Si ya pagaste, esperá unos segundos: lo detectamos solo.`
          : null
      );
    } finally {
      await refresh();
    }
  }

  if (polla.status !== "open" || polla.locked) {
    return (
      <Card>
        <h1 className="text-xl font-bold tracking-tight">{polla.name}</h1>
        <p className="text-sm leading-6 text-muted">
          {polla.status === "settled"
            ? "Esta polla ya se cerró y se repartió el pozo."
            : "Los pronósticos ya cerraron, así que no se puede entrar."}
        </p>
        <Link href={`/p/${polla.code}`} className="block">
          <Button variant="secondary" className="w-full py-3">
            Ver la tabla
          </Button>
        </Link>
      </Card>
    );
  }

  if (paid) {
    return (
      <Card>
        <h1 className="text-xl font-bold tracking-tight">Ya estás adentro</h1>
        <p className="text-sm leading-6 text-muted">
          Tu entrada de <span className="font-mono">{polla.entryAmount}</span>{" "}
          {currency ?? "USDC"} está pagada y anotada. Ahora cargá tus pronósticos
          antes del {formatDateTime(polla.deadlineAt)}.
        </p>
        <Link href={`/p/${polla.code}`} className="block">
          <Button className="w-full py-3">Cargar mis pronósticos</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
        <h1 className="text-xl font-bold tracking-tight">{polla.name}</h1>
        <dl className="flex flex-col divide-y divide-border">
          <Row label="Entrada">
            <span className="font-mono font-semibold">
              {polla.entryAmount} {currency ?? "USDC"}
            </span>
          </Row>
          <Row label="Organiza">{polla.organizer.name}</Row>
          <Row label="Partidos">{polla.matches.length}</Row>
          <Row label="Cierra">{formatDateTime(polla.deadlineAt)}</Row>
          <Row label="Ya entraron">
            {polla.pot.paidCount}{" "}
            {polla.pot.paidCount === 1 ? "jugador" : "jugadores"}
          </Row>
          <Row label="Puntaje">
            {polla.rules.exactPoints} exacto / {polla.rules.outcomePoints} resultado
          </Row>
        </dl>
        <p className="text-xs leading-5 text-muted">
          El pago va directo a la cuenta de {polla.organizer.name} (
          <span className="font-mono">
            {middleTruncate(polla.organizer.address, 6, 6)}
          </span>
          ). Esta app no guarda tu plata: solo anota quién pagó y lleva la tabla.
        </p>
      </section>

      {!user ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border px-6 py-10 text-center">
          <p className="text-sm text-muted">
            Ingresá con Pollar para pagar tu entrada. Si nunca usaste Pollar, con
            tu Google ya tenés cuenta y billetera.
          </p>
          <Button onClick={login}>Ingresar con Pollar</Button>
        </div>
      ) : !reservation ? (
        <section className="flex flex-col gap-4">
          <Input
            label="¿Cómo te ponemos en la tabla?"
            placeholder="Tu nombre o apodo"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            onClick={() => void reserve()}
            disabled={name.trim().length < 2}
            loading={busy || signing}
            className="w-full py-3"
          >
            Continuar
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <PayWithMemo
            amount={reservation.entry.amount}
            recipient={reservation.destination}
            memoId={reservation.entry.memoId}
            label={`Pagar ${reservation.entry.amount} ${currency ?? "USDC"} y entrar`}
            onPaid={report}
          />
          {waiting && !paid && (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
              Buscando tu pago en la red. Puede tardar unos segundos; no cierres
              esta pantalla.
            </p>
          )}
        </section>
      )}

      {(error || sessionError) && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error ?? sessionError}
        </p>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-6">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}
