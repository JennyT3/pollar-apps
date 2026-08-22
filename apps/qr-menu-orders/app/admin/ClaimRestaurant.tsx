"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { middleTruncate } from "@/lib/format";

type Mode = "create" | "restore";

/**
 * Onboarding for the owner: create a restaurant, or restore access with the
 * admin key. Payments go to the logged-in Pollar account, so a login is
 * required to create — but the key, not the address, is what authorizes
 * changes afterwards.
 */
export function ClaimRestaurant() {
  const { user } = usePollarAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ownerAddress: user.address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el local.");
      setIssued(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Esa clave no funcionó.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setBusy(false);
    }
  }

  // The token is shown exactly once. Nothing else can recover it.
  if (issued) {
    return (
      <Card>
        <h2 className="text-lg font-bold">Guardá tu clave de admin</h2>
        <p className="mt-2 text-sm text-muted">
          Es la única vez que se muestra. Con ella volvés a entrar a tu menú
          desde otro celular o después de limpiar el navegador. Nosotros solo
          guardamos una huella suya, así que no se puede recuperar ni reenviar.
        </p>
        <p className="mt-4 break-all rounded-xl border border-border bg-surface p-3 font-mono text-sm">
          {issued}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(issued);
              setCopied(true);
            }}
          >
            {copied ? "Copiada ✓" : "Copiar clave"}
          </Button>
          <Button onClick={() => router.refresh()}>Ya la guardé, seguir</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(["create", "restore"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {m === "create" ? "Nuevo local" : "Tengo una clave"}
          </button>
        ))}
      </div>

      <Card>
        {mode === "create" ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold">Configurá tu local</h2>
              <p className="mt-1 text-sm text-muted">
                Los comensales pagan directo a tu cuenta Pollar. Entrá con la
                cuenta que tiene que recibir la plata.
              </p>
            </div>

            {user ? (
              <p className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-muted">Los pagos van a</span>
                <span className="font-mono" title={user.address}>
                  {middleTruncate(user.address, 6, 6)}
                </span>
              </p>
            ) : (
              <LoginButton />
            )}

            <Input
              label="Nombre del local"
              placeholder="Pensión Doña Mary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              onClick={() => void create()}
              disabled={!user || !name.trim() || busy}
              loading={busy}
              className="w-full py-3"
            >
              {user ? "Crear local" : "Entrá primero"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold">Recuperar acceso</h2>
              <p className="mt-1 text-sm text-muted">
                Pegá la clave de admin que guardaste cuando creaste el local.
              </p>
            </div>
            <Input
              label="Clave de admin"
              placeholder="…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="font-mono"
            />
            <Button
              onClick={() => void restore()}
              disabled={!token.trim() || busy}
              loading={busy}
              className="w-full py-3"
            >
              Abrir mi local
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
