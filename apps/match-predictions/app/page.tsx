"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePollar } from "@pollar/react";
import { AppHeader } from "@/components/AppHeader";
import { BalanceCard } from "@/components/BalanceCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PollarBear } from "@/components/ui/PollarBear";
import { Spinner } from "@/components/ui/Spinner";
import { useAppSession } from "@/hooks/useAppSession";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/time";

interface PollaSummary {
  code: string;
  name: string;
  role: "organizer" | "player";
  status: "open" | "settled";
  deadlineAt: number;
  entryAmount: string;
  paid: boolean;
}

/**
 * Home: your pollas, or an explanation of what one is.
 *
 * Anyone with a code can jump straight into a polla without logging in, because
 * watching the standings is open to the whole group. Logging in is for the two
 * things that need an account: putting money in, and taking it out.
 */
export default function Home() {
  const { user, isLoading } = usePollarAuth();
  const { ready, busy: signing, ensure, error: sessionError } = useAppSession();
  // The SDK's own send and receive screens. Topping up a wallet is Pollar's
  // job, not this app's, so this opens what the SDK already ships instead of
  // building a second money-moving flow.
  const { openSendModal, openReceiveModal } = usePollar();
  const [pollas, setPollas] = useState<PollaSummary[] | null>(null);
  // Whose list is on screen. Adjusting it during render (rather than from an
  // effect) is how React wants derived state reset when a prop-like value
  // changes; the same pattern the template's SendModal uses.
  const [listedFor, setListedFor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const router = useRouter();

  if ((user?.address ?? null) !== listedFor) {
    setListedFor(user?.address ?? null);
    setPollas(null);
  }

  // Only load the list when this browser already carries a proof from an
  // earlier visit. A fresh login gets a button instead: signing in to Pollar
  // must not immediately fire an authenticated request at a session the SDK is
  // still confirming with its server.
  useEffect(() => {
    if (!user || !ready) return;
    let cancelled = false;
    void (async () => {
      const res = await api<{ pollas: PollaSummary[] }>("/api/pollas").catch(
        () => null
      );
      if (!cancelled) setPollas(res?.pollas ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, ready]);

  async function loadPollas() {
    try {
      await ensure();
      setPollas((await api<{ pollas: PollaSummary[] }>("/api/pollas")).pollas);
    } catch {
      // useAppSession already surfaces why; the list simply stays hidden.
    }
  }

  function open() {
    const clean = code.trim().toUpperCase();
    if (clean) router.push(`/p/${clean}`);
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        {!user ? (
          <section className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-light">
              <PollarBear size={64} />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                La polla del grupo, sin planilla
              </h1>
              <p className="mx-auto max-w-md text-sm leading-6 text-muted">
                Armá la fecha, que cada uno entre pagando con QR, y mirá la tabla
                moverse con cada resultado. El pozo vive en la cuenta del
                organizador y cada movimiento queda con su comprobante.
              </p>
            </div>
            {isLoading ? (
              <Spinner size={24} />
            ) : (
              <p className="text-sm text-muted">
                Ingresá con Pollar desde el botón de arriba para armar la tuya.
              </p>
            )}
          </section>
        ) : (
          <>
            <BalanceCard />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={openReceiveModal}
                className="flex-1 py-3"
              >
                Recibir
              </Button>
              <Button
                variant="secondary"
                onClick={openSendModal}
                className="flex-1 py-3"
              >
                Enviar
              </Button>
            </div>

            <Link href="/nueva" className="block">
              <Button className="w-full py-3">Armar una polla</Button>
            </Link>

            {sessionError && (
              <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
                {sessionError}
              </p>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-bold tracking-tight">Tus pollas</h2>
              {pollas === null ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border px-4 py-8 text-center">
                  <p className="text-sm text-muted">
                    Verificá tu cuenta para ver las pollas que organizás o jugás.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => void loadPollas()}
                    loading={signing}
                  >
                    Ver mis pollas
                  </Button>
                </div>
              ) : pollas.length > 0 ? (
                <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {pollas.map((polla) => (
                    <li key={polla.code}>
                      <Link
                        href={`/p/${polla.code}`}
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface"
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-semibold">
                            {polla.name}
                          </span>
                          <span className="truncate text-xs text-muted">
                            {polla.role === "organizer" ? "Organizás" : "Jugás"}
                            {" · "}
                            {polla.status === "settled"
                              ? "cerrada"
                              : `cierra ${formatDateTime(polla.deadlineAt)}`}
                          </span>
                        </div>
                        {polla.role === "player" && !polla.paid && (
                          <span className="shrink-0 rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">
                            sin pagar
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-border px-4 py-8 text-center text-sm text-muted">
                  Todavía no estás en ninguna. Armá una o pedí el código al que
                  organiza.
                </p>
              )}
            </section>
          </>
        )}

        <section className="flex flex-col gap-2 rounded-2xl border border-border p-5">
          <h2 className="text-base font-bold tracking-tight">
            ¿Te pasaron un código?
          </h2>
          <p className="text-sm text-muted">
            Escribilo acá y entrás directo a la tabla.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="ABC123"
              value={code}
              maxLength={8}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === "Enter" && open()}
              className="font-mono uppercase"
            />
            <Button onClick={open} disabled={!code.trim()}>
              Entrar
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}
