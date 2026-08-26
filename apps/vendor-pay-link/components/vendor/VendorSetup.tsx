"use client";

import { useState } from "react";
import { usePollar } from "@pollar/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { pollarFetch } from "@/lib/pollar-fetch";
import type { Vendor } from "@/lib/types";

export function VendorSetup({
  address,
  onReady,
}: {
  address: string;
  onReady: (vendor: Vendor) => void;
}) {
  const { getClient } = usePollar();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await pollarFetch(getClient(), address, "/api/vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, name }),
      });
      const data = (await res.json()) as { vendor?: Vendor; error?: string };
      if (!res.ok || !data.vendor) {
        setError(data.error ?? "No se pudo guardar el puesto");
        return;
      }
      onReady(data.vendor);
    } catch {
      setError("Error de red. Prueba de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-8 sm:max-w-lg sm:gap-8 sm:px-5 sm:py-10">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Puesto
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          ¿Cómo se llama tu puesto?
        </h1>
        <p className="text-base leading-7 text-muted">
          Ese nombre sale en tu QR permanente. Los compradores lo ven al
          escanear.
        </p>
      </div>

      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
        <Input
          label="Nombre del puesto"
          placeholder="Ej. Salteñas doña Rosa"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={48}
          autoFocus
        />
        {error && (
          <p className="rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <Button
          type="submit"
          loading={loading}
          disabled={name.trim().length < 2}
          className="w-full py-3"
        >
          Crear mi QR de cobro
        </Button>
      </form>
    </main>
  );
}
