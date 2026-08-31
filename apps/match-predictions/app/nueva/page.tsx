"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppSession } from "@/hooks/useAppSession";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { api } from "@/lib/api";
import { DEFAULT_RULES } from "@/lib/scoring";
import { toDateTimeLocal } from "@/lib/time";

interface MatchDraft {
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
}

function emptyMatch(kickoff: string): MatchDraft {
  return { homeTeam: "", awayTeam: "", kickoff };
}

/** Tomorrow at 15:00, so the form opens on something plausible. */
function defaultKickoff(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(15, 0, 0, 0);
  return toDateTimeLocal(date.getTime());
}

/**
 * Creating a polla: the matches, the entry, the deadline and the scoring, all
 * declared before anybody pays a cent.
 *
 * The organizer is never asked for an account number. The pot goes to the
 * Pollar account they are signed in with, and the request that creates the
 * polla is signed by that same account, so the two cannot disagree.
 */
export default function NuevaPolla() {
  const { user, login } = usePollarAuth();
  const { ensure, busy: signing } = useAppSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [entryAmount, setEntryAmount] = useState("5");
  const [deadline, setDeadline] = useState(defaultKickoff);
  const [exactPoints, setExactPoints] = useState(String(DEFAULT_RULES.exactPoints));
  const [outcomePoints, setOutcomePoints] = useState(
    String(DEFAULT_RULES.outcomePoints)
  );
  const [matches, setMatches] = useState<MatchDraft[]>(() => [
    emptyMatch(defaultKickoff()),
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setMatch(index: number, patch: Partial<MatchDraft>) {
    setMatches((prev) =>
      prev.map((match, i) => (i === index ? { ...match, ...patch } : match))
    );
  }

  const complete =
    name.trim().length >= 3 &&
    organizerName.trim().length >= 2 &&
    entryAmount.trim() !== "" &&
    matches.length > 0 &&
    matches.every(
      (match) => match.homeTeam.trim() && match.awayTeam.trim() && match.kickoff
    );

  async function create() {
    setSaving(true);
    setError(null);
    try {
      await ensure();
      const res = await api<{ code: string }>("/api/pollas", {
        method: "POST",
        json: {
          name: name.trim(),
          organizerName: organizerName.trim(),
          entryAmount: entryAmount.trim(),
          deadlineAt: new Date(deadline).getTime(),
          exactPoints: Number(exactPoints),
          outcomePoints: Number(outcomePoints),
          matches: matches.map((match) => ({
            homeTeam: match.homeTeam.trim(),
            awayTeam: match.awayTeam.trim(),
            kickoffAt: new Date(match.kickoff).getTime(),
          })),
        },
      });
      router.push(`/p/${res.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la polla.");
      setSaving(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Armar una polla</h1>
          <p className="text-sm text-muted">
            El pozo se junta en tu cuenta de Pollar. La app lo lleva anotado y
            prepara el pago al final: nunca toca tu plata.
          </p>
        </div>

        {!user ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border px-6 py-10 text-center">
            <p className="text-sm text-muted">
              Ingresá con Pollar para armar tu polla.
            </p>
            <Button onClick={login}>Ingresar con Pollar</Button>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-4">
              <Input
                label="Nombre de la polla"
                placeholder="Fecha 12 del Apertura"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
              />
              <Input
                label="Tu nombre"
                placeholder="Cómo te ven en la tabla"
                value={organizerName}
                maxLength={40}
                onChange={(event) => setOrganizerName(event.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Entrada por persona (USDC)"
                  inputMode="decimal"
                  value={entryAmount}
                  onChange={(event) =>
                    setEntryAmount(event.target.value.replace(",", "."))
                  }
                  className="font-mono"
                />
                <Input
                  label="Cierre de pronósticos"
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-bold tracking-tight">Puntaje</h2>
                <p className="text-sm text-muted">
                  Queda declarado desde ahora y se aplica solo. Nadie lo cambia
                  después.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Marcador exacto"
                  inputMode="numeric"
                  value={exactPoints}
                  onChange={(event) =>
                    setExactPoints(event.target.value.replace(/\D/g, "").slice(0, 3))
                  }
                  className="font-mono"
                />
                <Input
                  label="Solo el resultado"
                  inputMode="numeric"
                  value={outcomePoints}
                  onChange={(event) =>
                    setOutcomePoints(event.target.value.replace(/\D/g, "").slice(0, 3))
                  }
                  className="font-mono"
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-bold tracking-tight">Partidos</h2>
                <span className="text-sm text-muted">{matches.length}</span>
              </div>

              {matches.map((match, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-2xl border border-border p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Local"
                      placeholder="Bolívar"
                      value={match.homeTeam}
                      maxLength={40}
                      onChange={(event) =>
                        setMatch(index, { homeTeam: event.target.value })
                      }
                    />
                    <Input
                      label="Visitante"
                      placeholder="The Strongest"
                      value={match.awayTeam}
                      maxLength={40}
                      onChange={(event) =>
                        setMatch(index, { awayTeam: event.target.value })
                      }
                    />
                  </div>
                  <Input
                    label="Fecha y hora"
                    type="datetime-local"
                    value={match.kickoff}
                    onChange={(event) =>
                      setMatch(index, { kickoff: event.target.value })
                    }
                  />
                  {matches.length > 1 && (
                    <button
                      onClick={() =>
                        setMatches((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="self-start text-sm font-semibold text-error transition-opacity hover:opacity-80"
                    >
                      Quitar partido
                    </button>
                  )}
                </div>
              ))}

              <Button
                variant="secondary"
                onClick={() =>
                  setMatches((prev) => [
                    ...prev,
                    emptyMatch(prev[prev.length - 1]?.kickoff ?? defaultKickoff()),
                  ])
                }
                className="w-full py-3"
              >
                Agregar partido
              </Button>
            </section>

            {error && (
              <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
                {error}
              </p>
            )}

            <Button
              onClick={() => void create()}
              disabled={!complete}
              loading={saving || signing}
              className="w-full py-3"
            >
              {saving ? "Creando…" : "Crear polla"}
            </Button>
          </>
        )}
      </main>
    </>
  );
}
