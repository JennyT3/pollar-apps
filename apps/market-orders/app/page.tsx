"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PollarLogo } from "@/components/ui/PollarLogo";

const ADMIN_TOKEN_KEY = "ct_admin_token";

export default function HomePage() {
  const { user } = usePollarAuth();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [stallExists, setStallExists] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const [stallName, setStallName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The admin token exists only here, right after creation: shown once. */
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const address = user.address;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/stall?address=${address}`);
        if (res.ok && !cancelled) {
          setStallExists(true);
          setHasToken(Boolean(window.localStorage.getItem(ADMIN_TOKEN_KEY)));
        }
      } catch {
        // connection error: stay on the create screen
      }
      if (!cancelled) setChecking(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || checking) return;
    if (stallExists && hasToken) {
      router.replace("/casera/menu");
    } else if (stallExists && !hasToken) {
      router.replace("/casera/settings");
    }
  }, [user, checking, stallExists, hasToken, router]);

  async function createStall() {
    if (!user || !stallName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/stall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stallName.trim(),
          ownerAddress: user.address,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFreshToken(data.token);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "stall_exists"
            ? "Este puesto ya existe. Si perdiste tu clave, ve a Ajustes del puesto para restaurarla."
            : `No se pudo crear (${res.status})`
        );
      }
    } catch {
      setError("Error de conexión. Probá de nuevo.");
    }
    setCreating(false);
  }

  async function copyToken() {
    if (!freshToken) return;
    await navigator.clipboard.writeText(freshToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveTokenAndGo() {
    if (!freshToken) return;
    window.localStorage.setItem(ADMIN_TOKEN_KEY, freshToken);
    router.replace("/casera/menu");
  }

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Market Orders
            <span className="block text-primary">Casera Board</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Publicá la lista del día, recibí pedidos pagados por USDC y
            entregá sin fila. Ingresá con Pollar para crear tu puesto.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  if (freshToken) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <header className="flex items-center justify-between gap-3 py-2">
          <PollarLogo size={30} />
          <LoginButton />
        </header>
        <Card className="p-4">
          <h2 className="text-lg font-bold">¡Puesto creado!</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Esta es tu <span className="font-semibold text-foreground">clave de administración</span>.
            Guardala ahora: se muestra <span className="font-semibold text-foreground">una sola vez</span> y no
            hay forma de recuperarla. La necesitás para administrar el puesto
            desde este u otro dispositivo.
          </p>
          <div className="mt-4 rounded-xl border border-warning-border bg-warning-light p-3">
            <p className="break-all font-mono text-xs leading-5">{freshToken}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" onClick={() => void copyToken()}>
              {copied ? "Copiada ✓" : "Copiar clave"}
            </Button>
            <Button onClick={saveTokenAndGo}>Ya la guardé — ir a mi menú</Button>
          </div>
        </Card>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!stallExists) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <header className="flex items-center justify-between gap-3 py-2">
          <PollarLogo size={30} />
          <LoginButton />
        </header>
        <Card className="p-4">
          <h2 className="text-lg font-bold">Crear tu puesto</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Elegí el nombre de tu puesto. Después vas a recibir una clave de
            administración que se muestra una sola vez: guardala antes de
            seguir.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <Input
              label="Nombre del puesto"
              placeholder="Ej: La Casera de Jenny"
              value={stallName}
              onChange={(e) => setStallName(e.target.value)}
            />
            {error && <p className="text-sm text-error">{error}</p>}
            <Button
              onClick={() => void createStall()}
              disabled={!stallName.trim()}
              loading={creating}
            >
              Crear puesto
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </main>
  );
}