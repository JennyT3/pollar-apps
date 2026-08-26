"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { QrCode } from "@/components/QrCode";
import { useAppOrigin } from "@/components/ChargePayButton";
import { ReceivedPaymentsList } from "@/components/ReceivedPaymentsList";
import type { Charge, Sale, Vendor } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { usePollar } from "@pollar/react";
import { pollarFetch } from "@/lib/pollar-fetch";

export function ChargeScreen({ vendor }: { vendor: Vendor }) {
  const { getClient } = usePollar();
  const origin = useAppOrigin();
  const stallUrl = origin ? `${origin}/pay/s/${vendor.publicCode}` : "";
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    charge: Charge;
    sale: Sale;
  } | null>(null);

  const amountValid =
    /^\d+(\.\d{1,7})?$/.test(amount) && Number(amount) > 0;

  async function createCharge() {
    setLoading(true);
    setError(null);
    try {
      const res = await pollarFetch(getClient(), vendor.address, "/api/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorAddress: vendor.address,
          amount,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        charge?: Charge;
        sale?: Sale;
        error?: string;
      };
      if (!res.ok || !data.charge || !data.sale) {
        setError(data.error ?? "No se pudo crear el cobro");
        return;
      }
      setCreated({ charge: data.charge, sale: data.sale });
      setAmount("");
      setNote("");
    } catch {
      setError("Error de red. Prueba de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const chargeUrl =
    origin && created
      ? `${origin}/pay/c/${created.charge.id}`
      : "";

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface sm:rounded-3xl">
        <div className="flex flex-col items-center gap-4 px-4 py-5 sm:px-5 sm:py-6">
          <div className="text-center">
            <p className="text-base font-bold sm:text-lg">{vendor.name}</p>
            <p className="mt-1 text-sm text-muted">
              QR permanente · el comprador escribe el monto
            </p>
          </div>
          {stallUrl ? (
            <div className="w-full max-w-[220px] sm:max-w-[240px]">
              <QrCode value={stallUrl} size={220} title={stallUrl} />
            </div>
          ) : (
            <div className="aspect-square w-full max-w-[220px] animate-pulse rounded-xl bg-border" />
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Link
              href="/print"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-primary/30 bg-background px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-light"
            >
              Imprimir
            </Link>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!stallUrl}
              onClick={() => void navigator.clipboard.writeText(stallUrl)}
            >
              Copiar link
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Cobro de esta venta
          </h2>
          <p className="mt-1 text-sm text-muted">
            Monto fijo + nota. Dos toques y listo el QR.
          </p>
        </div>
        <Input
          label="Monto (USDC)"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
          className="font-mono"
        />
        <Input
          label="Nota (opcional)"
          placeholder="Ej. 2 salteñas + refresco"
          value={note}
          maxLength={80}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <p className="rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        <Button
          onClick={() => void createCharge()}
          disabled={!amountValid}
          loading={loading}
          className="w-full py-3"
        >
          Generar QR de cobro
        </Button>
      </section>

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Muestra este QR"
      >
        {created && (
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-3xl font-semibold tabular-nums">
              {formatMoney(created.charge.amount)}{" "}
              <span className="text-lg font-normal text-muted">USDC</span>
            </p>
            {created.charge.note && (
              <p className="text-center text-sm text-muted">
                {created.charge.note}
              </p>
            )}
            {chargeUrl && <QrCode value={chargeUrl} size={220} />}
            <Button
              variant="secondary"
              className="w-full"
              disabled={!chargeUrl}
              onClick={() => void navigator.clipboard.writeText(chargeUrl)}
            >
              Copiar link
            </Button>
            <Button className="w-full" onClick={() => setCreated(null)}>
              Listo
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function SalesTodayScreen({
  address,
  refreshKey,
}: {
  address: string;
  refreshKey: number;
}) {
  const { getClient } = usePollar();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<{
    count: number;
    total: string;
    sales: Sale[];
  }>({ count: 0, total: "0.00", sales: [] });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const tzOffset = new Date().getTimezoneOffset();
      const res = await pollarFetch(
        getClient(),
        address,
        `/api/sales?address=${encodeURIComponent(address)}&tzOffset=${tzOffset}`
      );
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        today: { count: number; total: string; sales: Sale[] };
      };
      if (!cancelled) {
        setToday(data.today);
        setLoading(false);
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [address, refreshKey, getClient]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Ventas hoy
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {loading ? "—" : today.count}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Total hoy
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {loading ? "—" : formatMoney(today.total)}
            <span className="ml-1 text-sm font-normal text-muted">USDC</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Lista de hoy</h2>
        <Link
          href="/historial"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Ver historial
        </Link>
      </div>

      {!loading && (
        <ReceivedPaymentsList
          sales={today.sales}
          emptyText="Todavía no hay pagos hoy. Genera un cobro o espera a que alguien escanee tu QR."
        />
      )}
    </div>
  );
}

export function PaymentsHistoryScreen({
  address,
  refreshKey,
}: {
  address: string;
  refreshKey: number;
}) {
  const { getClient } = usePollar();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await pollarFetch(
        getClient(),
        address,
        `/api/sales?address=${encodeURIComponent(address)}&tzOffset=${new Date().getTimezoneOffset()}`
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
  }, [address, refreshKey, getClient]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold">Pagos recibidos</h2>
        <p className="mt-1 text-sm text-muted">
          Todo lo que ya te pagaron, del más reciente al más antiguo.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <ReceivedPaymentsList
          sales={sales}
          emptyText="Todavía no hay pagos recibidos."
        />
      )}
    </div>
  );
}
