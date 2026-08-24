"use client";

import { useEffect, useState } from "react";
import { LoginButton } from "@/components/LoginButton";
import { ChargePayButton } from "@/components/ChargePayButton";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { WalletBalancesMenu } from "@/components/WalletBalancesMenu";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatMoney } from "@/lib/format";
import type { Charge, Sale, Vendor } from "@/lib/types";

export function ChargePayPage({ id }: { id: string }) {
  const { user, login, isLoading } = usePollarAuth();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/charges/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (!cancelled) setError("Este cobro no existe o ya no está disponible.");
        return;
      }
      const data = (await res.json()) as {
        charge: Charge;
        sale: Sale | null;
        vendor: Vendor | null;
      };
      if (cancelled) return;
      setCharge(data.charge);
      setSale(data.sale);
      setVendor(data.vendor);
      if (data.sale?.status === "paid") setPaid(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
        <h1 className="text-2xl font-bold">Cobro no encontrado</h1>
        <p className="text-muted">{error}</p>
      </main>
    );
  }

  if (!charge || !sale || !vendor) {
    return (
      <main className="flex flex-1 items-center justify-center py-20">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6 sm:max-w-lg sm:gap-6 sm:px-5 sm:py-8">
      <header className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Pagar a
          </p>
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {vendor.name}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {user && <WalletBalancesMenu />}
          <LoginButton />
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-surface px-5 py-6 text-center">
        <p className="text-sm text-muted">Monto</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">
          {formatMoney(charge.amount)}{" "}
          <span className="text-lg font-normal text-muted">USD</span>
        </p>
        {charge.note && (
          <p className="mt-3 text-sm text-muted">{charge.note}</p>
        )}
      </div>

      {paid || sale.status === "paid" ? (
        <div className="rounded-2xl border border-success-border bg-success-light px-5 py-6 text-center">
          <p className="text-lg font-semibold text-success">¡Pago enviado!</p>
          <p className="mt-1 text-sm text-muted">
            {vendor.name} ya recibió {formatMoney(charge.amount)} USD
          </p>
        </div>
      ) : !user ? (
        <Button onClick={login} loading={isLoading} className="w-full py-3">
          Inicia sesión para pagar
        </Button>
      ) : (
        <ChargePayButton
          amount={sale.amount}
          recipient={vendor.address}
          memo={sale.memo}
          saleId={sale.id}
          onSuccess={() => setPaid(true)}
        />
      )}
    </main>
  );
}
