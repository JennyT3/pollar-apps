"use client";

import { useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import { useBalance } from "@/hooks/useBalance";
import { useUsdcAsset } from "@/hooks/useUsdcAsset";
import { useCasera } from "../casera-context";
import { BalanceCard } from "@/components/BalanceCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminHeaders } from "@/lib/fetch";

interface Order {
  id: string;
  total: number;
  status: string;
  txHash: string | null;
  pickupCode: string;
  memo: string;
  createdAt: string;
  deliveredAt: string | null;
  items: { name: string; price: number; quantity: number }[];
}

const STELLAR_EXPLORER = "https://stellar.expert/explorer/testnet/tx";

export default function CaseraBoardPage() {
  const { stall, adminToken } = useCasera();
  const { getClient } = usePollar();
  const { asset } = useBalance();
  const { currency, ready, payAsset } = useUsdcAsset();

  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"today" | "history">("today");
  const [msg, setMsg] = useState<string | null>(null);

  // Orders poll + pending expiry.
  useEffect(() => {
    if (!stall) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/order?stallId=${stall!.id}`, {
          headers: adminHeaders(adminToken),
        });
        if (res.ok && !cancelled) setOrders(await res.json());
      } catch {
        // poll again next tick
      }
    }
    async function expire() {
      try {
        await fetch("/api/order/expire", { method: "POST" });
      } catch {
        // ignore
      }
    }
    void load();
    void expire();
    const iv = setInterval(() => void load(), 5000);
    const ivExpire = setInterval(() => void expire(), 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
      clearInterval(ivExpire);
    };
  }, [stall, adminToken]);

  // Casera-side fallback detection: poll the SDK tx history and report any
  // tx whose memo matches a pending order (the customer's confirmation is the
  // primary path; this catches payments lost before that PATCH landed).
  useEffect(() => {
    if (!stall) return;
    let cancelled = false;
    async function detectPayments() {
      try {
        const client = getClient();
        await client.fetchTxHistory({ limit: 20 });
        const state = client.getTxHistoryState();
        if (state.step !== "loaded") return;
        const res = await fetch(`/api/order?stallId=${stall!.id}`, {
          headers: adminHeaders(adminToken),
        });
        if (!res.ok) return;
        const all: Order[] = await res.json();
        for (const order of all.filter((o) => o.status === "pending")) {
          const tx = state.data.records.find(
            (t: { memo?: unknown; hash: string }) => t.memo === order.memo
          );
          if (tx && !cancelled) {
            await fetch("/api/order/status", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: order.id,
                status: "paid",
                txHash: tx.hash,
              }),
            });
          }
        }
      } catch {
        // detection retries next tick
      }
    }
    void detectPayments();
    const ivDetect = setInterval(() => void detectPayments(), 10000);
    return () => {
      cancelled = true;
      clearInterval(ivDetect);
    };
  }, [stall, adminToken, getClient]);

  async function markReady(orderId: string) {
    const res = await fetch("/api/order/status", {
      method: "PATCH",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ id: orderId, status: "ready" }),
    });
    if (!res.ok) {
      setMsg(`No se pudo marcar listo (${res.status})`);
      return;
    }
    setMsg(null);
    const reloadRes = await fetch(`/api/order?stallId=${stall!.id}`, {
      headers: adminHeaders(adminToken),
    });
    if (reloadRes.ok) setOrders(await reloadRes.json());
  }

  if (!stall) return null;

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(todayPrefix));
  const historyOrders = orders.filter((o) => !o.createdAt.startsWith(todayPrefix));

  const pending = todayOrders.filter((o) => o.status === "pending");
  const paidReady = todayOrders.filter(
    (o) => o.status === "paid" || o.status === "ready"
  );
  const delivered = todayOrders.filter((o) => o.status === "delivered");
  const totalCollected = todayOrders
    .filter((o) => ["paid", "ready", "delivered"].includes(o.status))
    .reduce((s, o) => s + o.total, 0);

  const currencyLabel = currency ?? (ready ? "USDC" : "…");

  return (
    <div className="flex flex-col gap-4">
      <BalanceCard />

      {ready && !payAsset && asset && (
        <div className="rounded-2xl border border-warning-border bg-warning-light px-4 py-3 text-sm text-warning">
          No se encontró USDC en tus balances. Los precios y pagos son solo en
          USDC: recibí algo de USDC para habilitar los pedidos.
        </div>
      )}

      {msg && <p className="text-sm text-error">{msg}</p>}

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("today")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "today"
              ? "border-primary text-primary"
              : "border-transparent text-muted"
          }`}
        >
          Hoy ({todayOrders.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted"
          }`}
        >
          Historial ({historyOrders.length})
        </button>
      </div>

      {tab === "today" ? (
        <TodaySummary
          pending={pending}
          paidReady={paidReady}
          delivered={delivered}
          currencyLabel={currencyLabel}
          onMarkReady={markReady}
          orderCount={todayOrders.length}
          totalCollected={totalCollected}
        />
      ) : (
        <HistoryList orders={historyOrders} currencyLabel={currencyLabel} />
      )}
    </div>
  );
}

function TodaySummary({
  pending,
  paidReady,
  delivered,
  currencyLabel,
  onMarkReady,
  orderCount,
  totalCollected,
}: {
  pending: Order[];
  paidReady: Order[];
  delivered: Order[];
  currencyLabel: string;
  onMarkReady: (orderId: string) => Promise<void>;
  orderCount: number;
  totalCollected: number;
}) {
  return (
    <>
      <section>
        <h2 className="font-semibold">Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <Card className="mt-2 p-4 text-center">
            <p className="text-sm text-muted">Sin órdenes pendientes</p>
          </Card>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {pending.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <p className="font-mono text-lg font-bold text-warning">
                      {o.total} {currencyLabel}
                    </p>
                    <p className="text-xs text-muted">Código: {o.pickupCode}</p>
                    <p className="text-xs text-muted">Memo: {o.memo}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warning-light px-2 py-1 text-xs font-medium text-warning">
                    Esperando pago…
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold">Pagadas / Listas ({paidReady.length})</h2>
        {paidReady.length === 0 ? (
          <Card className="mt-2 p-4 text-center">
            <p className="text-sm text-muted">Sin órdenes pagadas</p>
          </Card>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {paidReady.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <p className="font-mono text-lg font-bold text-success">
                      {o.total} {currencyLabel}
                    </p>
                    <p className="text-xs text-muted">Código: {o.pickupCode}</p>
                    {o.txHash && <TxLink hash={o.txHash} />}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full bg-success-light px-2 py-1 text-xs font-medium text-success">
                      {o.status === "paid" ? "Pagado" : "Listo"}
                    </span>
                    {o.status === "paid" && (
                      <Button
                        variant="secondary"
                        onClick={() => void onMarkReady(o.id)}
                        className="px-3 py-1.5 text-xs"
                      >
                        Marcar listo
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold">Entregadas ({delivered.length})</h2>
        {delivered.length === 0 ? (
          <Card className="mt-2 p-4 text-center">
            <p className="text-sm text-muted">Sin entregas</p>
          </Card>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {delivered.map((o) => (
              <Card key={o.id} className="p-4 opacity-60">
                <p className="text-sm font-medium line-through">
                  {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                </p>
                <p className="text-xs text-muted">
                  Entregado · {o.pickupCode}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="p-4">
        <p className="text-sm text-muted">Resumen del día</p>
        <p className="font-mono text-xl font-bold">
          {orderCount} órdenes · {totalCollected} {currencyLabel}
        </p>
      </Card>
    </>
  );
}

function HistoryList({
  orders,
  currencyLabel,
}: {
  orders: Order[];
  currencyLabel: string;
}) {
  if (orders.length === 0) {
    return (
      <Card className="p-4 text-center">
        <p className="text-sm text-muted">Sin órdenes pasadas</p>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => (
        <Card key={o.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
              </p>
              <p className="font-mono text-lg font-bold">
                {o.total} {currencyLabel}
              </p>
              <p className="text-xs text-muted">
                {new Date(o.createdAt).toLocaleDateString()} · {o.status}
              </p>
              {o.txHash && <TxLink hash={o.txHash} />}
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                o.status === "delivered"
                  ? "bg-success-light text-success"
                  : o.status === "paid" || o.status === "ready"
                    ? "bg-primary-light text-primary"
                    : "bg-warning-light text-warning"
              }`}
            >
              {o.status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`${STELLAR_EXPLORER}/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-xs text-primary underline"
    >
      {hash}
    </a>
  );
}