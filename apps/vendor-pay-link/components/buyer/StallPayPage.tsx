"use client";

import { useEffect, useState } from "react";
import { LoginButton } from "@/components/LoginButton";
import { ChargePayButton } from "@/components/ChargePayButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { WalletBalancesMenu } from "@/components/WalletBalancesMenu";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatMoney } from "@/lib/format";
import type { Sale, Vendor } from "@/lib/types";

export function StallPayPage({ code }: { code: string }) {
  const { user, login, isLoading } = usePollarAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [creating, setCreating] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/stall/${encodeURIComponent(code)}`);
      if (!res.ok) {
        if (!cancelled) setLoadError("No encontramos este puesto.");
        return;
      }
      const data = (await res.json()) as { vendor: Vendor };
      if (!cancelled) setVendor(data.vendor);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const amountValid =
    /^\d+(\.\d{1,7})?$/.test(amount) && Number(amount) > 0;

  async function prepareSale() {
    if (!vendor) return;
    setCreating(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorAddress: vendor.address,
          amount,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { sale?: Sale; error?: string };
      if (res.ok && data.sale) setSale(data.sale);
    } finally {
      setCreating(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
        <h1 className="text-2xl font-bold">Puesto no encontrado</h1>
        <p className="text-muted">{loadError}</p>
      </main>
    );
  }

  if (!vendor) {
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
          <p className="mt-1 text-sm text-muted">
            Escribe cuánto debes y confirma el pago.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {user && <WalletBalancesMenu />}
          <LoginButton />
        </div>
      </header>

      {paid ? (
        <div className="rounded-2xl border border-success-border bg-success-light px-5 py-6 text-center">
          <p className="text-lg font-semibold text-success">¡Pago enviado!</p>
          <p className="mt-1 text-sm text-muted">
            {formatMoney(sale?.amount ?? amount)} a {vendor.name}
          </p>
        </div>
      ) : !sale ? (
        <div className="flex flex-col gap-4">
          <Input
            label="Monto"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            className="text-lg"
            autoFocus
          />
          <Input
            label="Nota (opcional)"
            placeholder="¿Qué estás pagando?"
            value={note}
            maxLength={80}
            onChange={(e) => setNote(e.target.value)}
          />
          {!user ? (
            <Button onClick={login} loading={isLoading} className="w-full py-3">
              Inicia sesión para pagar
            </Button>
          ) : (
            <Button
              onClick={() => void prepareSale()}
              disabled={!amountValid}
              loading={creating}
              className="w-full py-3"
            >
              Continuar
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface px-5 py-5 text-center">
            <p className="text-sm text-muted">Vas a pagar</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {formatMoney(sale.amount)}{" "}
              <span className="text-lg font-normal text-muted">USDC</span>
            </p>
            {sale.note && (
              <p className="mt-2 text-sm text-muted">{sale.note}</p>
            )}
          </div>
          <ChargePayButton
            amount={sale.amount}
            recipient={vendor.address}
            memo={sale.memo}
            saleId={sale.id}
            onSuccess={() => setPaid(true)}
          />
          <Button variant="ghost" onClick={() => setSale(null)}>
            Cambiar monto
          </Button>
        </div>
      )}
    </main>
  );
}
