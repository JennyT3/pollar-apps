"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { ReceivedPaymentsList } from "@/components/ReceivedPaymentsList";
import { usePollar } from "@pollar/react";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { pollarFetch } from "@/lib/pollar-fetch";
import type { Sale } from "@/lib/types";

export default function HistoryPage() {
  const { user } = usePollarAuth();
  const { getClient } = usePollar();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const res = await pollarFetch(
        getClient(),
        user!.address,
        `/api/sales?address=${encodeURIComponent(user!.address)}&tzOffset=${new Date().getTimezoneOffset()}`
      );
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = (await res.json()) as { sales: Sale[] };
      if (!cancelled) {
        setSales(data.sales.filter((s) => s.status === "paid"));
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, getClient]);

  if (!user) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16">
        <p className="text-muted">Inicia sesión para ver los pagos recibidos.</p>
        <LoginButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-semibold text-primary">
            ← Cobrar
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Pagos recibidos</h1>
        </div>
        <LoginButton />
      </header>

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <ReceivedPaymentsList
          sales={sales}
          emptyText="Todavía no hay pagos recibidos."
        />
      )}
    </main>
  );
}
