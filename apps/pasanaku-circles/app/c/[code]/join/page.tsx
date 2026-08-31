"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { usePollarAuth } from "@/hooks/usePollarAuth";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { user, login } = usePollarAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!user) {
      login();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/circles/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: user.address }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "no se pudo unir");
      router.push(`/c/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "no se pudo unir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h2 className="text-2xl font-bold">Unirse al círculo</h2>
      <p className="text-muted">Código {code}</p>
      <Button onClick={join} loading={busy}>
        {user ? "Unirme" : "Entrar con Pollar"}
      </Button>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </AppShell>
  );
}
