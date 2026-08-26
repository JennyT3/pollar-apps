"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode } from "@/components/QrCode";
import { useAppOrigin } from "@/components/ChargePayButton";
import { usePollar } from "@pollar/react";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { pollarFetch } from "@/lib/pollar-fetch";
import type { Vendor } from "@/lib/types";

/**
 * Clean printable view: big QR + vendor name. Nothing else.
 * Designed to be taped to a counter / caja.
 */
export default function PrintPage() {
  const { user } = usePollarAuth();
  const { getClient } = usePollar();
  const origin = useAppOrigin();
  const [vendor, setVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    if (!user) return;
    void pollarFetch(
      getClient(),
      user.address,
      `/api/vendor?address=${encodeURIComponent(user.address)}`
    )
      .then((r) => r.json())
      .then((d: { vendor: Vendor | null }) => setVendor(d.vendor));
  }, [user, getClient]);

  const stallUrl =
    origin && vendor ? `${origin}/pay/s/${vendor.publicCode}` : "";

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-muted">Inicia sesión para imprimir tu QR.</p>
        <Link href="/" className="font-semibold text-primary hover:underline">
          Volver
        </Link>
      </main>
    );
  }

  if (!vendor || !stallUrl) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-muted">
        Cargando…
      </main>
    );
  }

  return (
    <>
      <div className="print:hidden mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-primary">
            ← Volver
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Imprimir
          </button>
        </div>
        <p className="text-sm text-muted">
          Vista limpia para pegar en el mostrador. Solo el nombre y el código.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 px-6 py-10 print:max-w-none print:py-16">
        <h1 className="text-center text-3xl font-bold tracking-tight print:text-4xl">
          {vendor.name}
        </h1>
        <QrCode value={stallUrl} size={280} />
        <p className="text-center text-sm text-muted print:text-base">
          Escanea y paga con Pollar
        </p>
      </div>
    </>
  );
}
