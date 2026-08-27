"use client";

import { useState, useEffect } from "react";
import { usePollar } from "@pollar/react";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useBalance } from "@/hooks/useBalance";
import { LoginButton } from "@/components/LoginButton";
import { BalanceCard } from "@/components/BalanceCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { paymentAssetFrom, currencyOf } from "@/lib/payments";
import { QRCodeSVG } from "qrcode.react";
import { adminHeaders } from "@/lib/fetch";

const ADMIN_TOKEN_KEY = "ct_admin_token";

function loadAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

interface Stall {
  id: string;
  name: string;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldOut: boolean;
}

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

export default function CaseraBoard() {
  const { user } = usePollarAuth();
  const { getClient } = usePollar();
  const { asset } = useBalance();
  const currency = currencyOf(paymentAssetFrom(asset));

  const [stall, setStall] = useState<Stall | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stallName, setStallName] = useState("");
  const [creatingStall, setCreatingStall] = useState(false);
  const [tab, setTab] = useState<"today" | "history">("today");
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    loadAdminToken()
  );
  const [restoreToken, setRestoreToken] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQty, setItemQty] = useState("");

  const [pickupCode, setPickupCode] = useState("");
  const [pickupMsg, setPickupMsg] = useState<{
    type: "ok" | "err" | "warn";
    text: string;
  } | null>(null);
  const [itemMsg, setItemMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/stall?address=${user!.address}`);
        if (res.ok && !cancelled) setStall(await res.json());
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!stall) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/order?stallId=${stall!.id}`, {
          headers: adminHeaders(adminToken),
        });
        if (res.ok && !cancelled) setOrders(await res.json());
      } catch (e) {
        console.error(e);
      }
    }
    async function expire() {
      try { await fetch("/api/order/expire", { method: "POST" }); } catch {}
    }
    load();
    expire();
    const iv = setInterval(load, 5000);
    const ivExpire = setInterval(expire, 30000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(ivExpire); };
  }, [stall, adminToken]);

  useEffect(() => {
    if (!stall || !user) return;
    let cancelled = false;
    async function detectPayments() {
      try {
        const client = getClient();
        await client.fetchTxHistory({ limit: 20 });
        const state = client.getTxHistoryState();
        if (state.step !== "loaded") return;
        const txs = state.data.records;
        const res = await fetch(`/api/order?stallId=${stall!.id}`, {
          headers: adminHeaders(adminToken),
        });
        if (!res.ok) return;
        const pendingOrders: Order[] = await res.json();
        for (const order of pendingOrders.filter(o => o.status === "pending")) {
          const tx = txs.find((t: { memo?: string; hash: string }) =>
            t.memo === order.memo
          );
          if (tx && !cancelled) {
            await fetch("/api/order/status", {
              method: "PATCH",
              body: JSON.stringify({ id: order.id, status: "paid", txHash: tx.hash }),
            });
          }
        }
      } catch (e) {
        console.error("detectPayments:", e);
      }
    }
    detectPayments();
    const ivDetect = setInterval(detectPayments, 10000);
    return () => { cancelled = true; clearInterval(ivDetect); };
  }, [stall, user, adminToken]);

  async function createStall() {
    if (!user || !stallName.trim()) return;
    setCreatingStall(true);
    const res = await fetch("/api/stall", {
      method: "POST",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ name: stallName.trim(), ownerAddress: user.address }),
    });
    if (res.ok) {
      const data = await res.json();
      const token = data.token;
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
      setAdminToken(token);
      setStall(data.stall);
    } else {
      const data = await res.json().catch(() => ({}));
      setItemMsg(`No se pudo crear el puesto (${res.status} ${data.error ?? ""})`.trim());
    }
    setStallName("");
    setCreatingStall(false);
  }

  async function restoreAdmin() {
    const token = restoreToken.trim();
    if (!token || !stall) return;
    const res = await fetch(`/api/order?stallId=${stall!.id}`, {
      headers: adminHeaders(token),
    });
    if (!res.ok) {
      setItemMsg("Esa clave no coincide con este puesto.");
      return;
    }
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setAdminToken(token);
    setOrders(await res.json());
    setRestoreToken("");
    setItemMsg(null);
  }

  async function addItem() {
    if (!user || !stall || !itemName.trim() || !itemPrice || !itemQty) return;
    const res = await fetch("/api/stall/items", {
      method: "POST",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({
        stallId: stall.id,
        name: itemName.trim(),
        price: parseFloat(itemPrice),
        quantity: parseInt(itemQty),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setItemMsg(`No se pudo agregar el item (${res.status} ${data.error ?? ""})`.trim());
      return;
    }
    setItemName("");
    setItemPrice("");
    setItemQty("");
    setItemMsg(null);
    const reload = await fetch(`/api/stall?address=${user!.address}`);
    if (reload.ok) setStall(await reload.json());
  }

  async function toggleSoldOut(itemId: string, current: boolean) {
    const res = await fetch("/api/stall/items", {
      method: "PATCH",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ id: itemId, soldOut: !current }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setItemMsg(`No se pudo actualizar (${res.status} ${data.error ?? ""})`.trim());
      return;
    }
    setItemMsg(null);
    const reload = await fetch(`/api/stall?address=${user!.address}`);
    if (reload.ok) setStall(await reload.json());
  }

  async function markReady(orderId: string) {
    const res = await fetch("/api/order/status", {
      method: "PATCH",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ id: orderId, status: "ready" }),
    });
    if (!res.ok) {
      setItemMsg(`No se pudo marcar listo (${res.status})`);
      return;
    }
    setItemMsg(null);
    const reload = await fetch(`/api/order?stallId=${stall!.id}`, {
      headers: adminHeaders(adminToken),
    });
    if (reload.ok) setOrders(await reload.json());
  }

  async function verifyPickup() {
    const code = pickupCode.trim().toUpperCase();
    if (!code || !user) return;
    const res = await fetch("/api/pickup", {
      method: "POST",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.ok) {
      setPickupMsg({
        type: "ok",
        text: `ENTREGADO - ${data.order.items.map((i: { name: string; quantity: number }) => `${i.quantity}x ${i.name}`).join(", ")}`,
      });
    } else if (data.reason === "already_delivered") {
      setPickupMsg({ type: "err", text: "RECHAZADO - Codigo ya used" });
    } else if (data.reason === "not_found") {
      setPickupMsg({ type: "err", text: "Codigo no encontrado" });
    } else if (data.reason === "not_authorized") {
      setPickupMsg({ type: "err", text: "No eres la casera de este puesto" });
    } else {
      setPickupMsg({ type: "warn", text: "Orden no esta lista" });
    }
    setPickupCode("");
    const orderRes = await fetch(`/api/order?stallId=${stall!.id}`, {
      headers: adminHeaders(adminToken),
    });
    if (orderRes.ok) setOrders(await orderRes.json());
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
            Login to manage your stall, orders, and pickups.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  if (!stall) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <header className="flex items-center justify-between gap-3 py-2">
          <PollarLogo size={30} />
          <LoginButton />
        </header>
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Crear tu puesto</p>
          <Input
            label="Nombre del puesto"
            placeholder="Ej: La Casera de Jenny"
            value={stallName}
            onChange={(e) => setStallName(e.target.value)}
          />
          <Button onClick={createStall} disabled={!stallName.trim()} loading={creatingStall} className="mt-3">
            Crear
          </Button>
        </Card>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(today));
  const historyOrders = orders.filter((o) => !o.createdAt.startsWith(today));

  const pending = todayOrders.filter((o) => o.status === "pending");
  const paid = todayOrders.filter((o) => o.status === "paid" || o.status === "ready");
  const delivered = todayOrders.filter((o) => o.status === "delivered");
  const totalCollected = todayOrders
    .filter((o) => ["paid", "ready", "delivered"].includes(o.status))
    .reduce((s, o) => s + o.total, 0);

  const stallUrl = typeof window !== "undefined" ? `${window.location.origin}/stall/${stall.id}` : "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 lg:max-w-lg lg:py-10">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="text-xl font-bold tracking-tight">{stall.name}</h1>
        </div>
        <LoginButton />
      </header>

      <BalanceCard />

      <Card className="p-3">
        <p className="text-xs text-muted">Tu direccion:</p>
        <p className="break-all font-mono text-xs">{user.address}</p>
      </Card>

      {adminToken ? (
        <Card className="p-3">
          <p className="text-xs text-muted">Clave de administracion:</p>
          <p className="break-all font-mono text-xs">{adminToken}</p>
          <p className="mt-1 text-xs text-muted">
            Guardala: la necesitas para administrar este puesto desde otro
            dispositivo.
          </p>
        </Card>
      ) : (
        <Card className="p-3">
          <p className="mb-1 text-sm font-medium">Pegá tu clave de administracion</p>
          <div className="flex gap-2">
            <Input
              placeholder="ct_..."
              value={restoreToken}
              onChange={(e) => setRestoreToken(e.target.value)}
              className="flex-1"
            />
            <Button onClick={restoreAdmin} disabled={!restoreToken.trim()} className="px-3">
              Vincular
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Guardala bien: si la perdes, no hay forma de recuperarla.
          </p>
          {itemMsg && <p className="mt-2 text-sm text-destructive">{itemMsg}</p>}
        </Card>
      )}

      {stallUrl && (
        <Card className="flex flex-col items-center gap-3 p-4">
          <p className="text-sm font-medium">QR del puesto (para imprimir)</p>
          <QRCodeSVG value={stallUrl} size={180} />
          <p className="break-all text-center text-xs text-muted">{stallUrl}</p>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Tu menu</h2>
      </div>

      <Card className="p-4">
        <div className="flex gap-2">
          <Input placeholder="Nombre" value={itemName} onChange={(e) => setItemName(e.target.value)} className="flex-1" />
          <Input placeholder="Precio" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} type="number" className="w-20" />
          <Input placeholder="Cant." value={itemQty} onChange={(e) => setItemQty(e.target.value)} type="number" className="w-16" />
          <Button onClick={addItem} disabled={!itemName.trim() || !itemPrice || !itemQty} className="px-3">
            +
          </Button>
        </div>
        {itemMsg && <p className="mt-2 text-sm text-destructive">{itemMsg}</p>}
      </Card>

      {stall.items.map((item) => (
        <Card key={item.id} className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${item.soldOut ? "line-through text-muted" : ""}`}>
                {item.name}
              </p>
              <p className="font-mono text-sm text-muted">
                {item.price} {currency} · {item.quantity} disponibles
              </p>
            </div>
            <Button
              variant={item.soldOut ? "secondary" : "ghost"}
              onClick={() => toggleSoldOut(item.id, item.soldOut)}
              className="px-3 py-1.5 text-xs"
            >
              {item.soldOut ? "Reponer" : "Se acabó"}
            </Button>
          </div>
        </Card>
      ))}

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("today")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "today" ? "border-primary text-primary" : "border-transparent text-muted"
          }`}
        >
          Hoy ({todayOrders.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "history" ? "border-primary text-primary" : "border-transparent text-muted"
          }`}
        >
          Historial ({historyOrders.length})
        </button>
      </div>

      {tab === "today" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pendientes ({pending.length})</h2>
          </div>

          {pending.length === 0 ? (
            <Card className="p-4 text-center">
              <p className="text-sm text-muted">Sin ordenes pendientes</p>
            </Card>
          ) : (
            pending.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <p className="font-mono text-lg font-bold text-warning">
                      {o.total} {currency}
                    </p>
                    <p className="text-xs text-muted">Code: {o.pickupCode}</p>
                    <p className="text-xs text-muted">Memo: {o.memo}</p>
                    {o.txHash && (
                      <div className="mt-2">
                        <p className="text-xs text-muted">Hash:</p>
                        <a
                          href={`${STELLAR_EXPLORER}/${o.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-mono text-xs text-primary underline"
                        >
                          {o.txHash}
                        </a>
                        <Button variant="secondary" onClick={() => markReady(o.id)} className="mt-2 px-3 py-1.5 text-xs">
                          Marcar listo
                        </Button>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-warning-light px-2 py-1 text-xs font-medium text-warning">
                    {o.txHash ? "Hash OK" : "Esperando..."}
                  </span>
                </div>
              </Card>
            ))
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pagadas / Listas ({paid.length})</h2>
          </div>

          {paid.length === 0 ? (
            <Card className="p-4 text-center">
              <p className="text-sm text-muted">Sin ordenes pagadas</p>
            </Card>
          ) : (
            paid.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <p className="font-mono text-lg font-bold text-success">
                      {o.total} {currency}
                    </p>
                    <p className="text-xs text-muted">Code: {o.pickupCode}</p>
                    {o.txHash && (
                      <a
                        href={`${STELLAR_EXPLORER}/${o.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-primary underline"
                      >
                        Hash: {o.txHash}
                      </a>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-success-light px-2 py-1 text-xs font-medium text-success">
                    {o.status === "paid" ? "Pagado" : "Listo"}
                  </span>
                </div>
              </Card>
            ))
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Entregadas ({delivered.length})</h2>
          </div>

          {delivered.length === 0 ? (
            <Card className="p-4 text-center">
              <p className="text-sm text-muted">Sin entregas</p>
            </Card>
          ) : (
            delivered.map((o) => (
              <Card key={o.id} className="p-4 opacity-60">
                <p className="text-sm font-medium line-through">
                  {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                </p>
                <p className="text-xs text-muted">Entregado</p>
              </Card>
            ))
          )}

          <Card className="p-4">
            <p className="text-sm text-muted">Resumen del dia</p>
            <p className="font-mono text-xl font-bold">
              {todayOrders.length} ordenes · {totalCollected} {currency}
            </p>
          </Card>
        </>
      )}

      {tab === "history" && (
        <>
          {historyOrders.length === 0 ? (
            <Card className="p-4 text-center">
              <p className="text-sm text-muted">Sin ordenes pasadas</p>
            </Card>
          ) : (
            historyOrders.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <p className="font-mono text-lg font-bold">
                      {o.total} {currency}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(o.createdAt).toLocaleDateString()} · {o.status}
                    </p>
                    {o.txHash && (
                      <a
                        href={`${STELLAR_EXPLORER}/${o.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-primary underline"
                      >
                        Ver en explorer
                      </a>
                    )}
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
            ))
          )}
        </>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h2 className="font-semibold">Verificar pickup</h2>
        <div className="flex gap-2">
          <input
            placeholder="Codigo"
            value={pickupCode}
            onChange={(e) => setPickupCode(e.target.value.toUpperCase())}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 font-mono text-sm tracking-widest"
          />
          <Button onClick={verifyPickup} disabled={!pickupCode.trim()}>
            Verificar
          </Button>
        </div>
        {pickupMsg && (
          <p
            className={`rounded-xl border p-3 text-center text-sm font-medium ${
              pickupMsg.type === "ok"
                ? "border-success-border bg-success-light text-success"
                : pickupMsg.type === "err"
                  ? "border-error-border bg-error-light text-error"
                  : "border-warning-border bg-warning-light text-warning"
            }`}
          >
            {pickupMsg.text}
          </p>
        )}
      </div>

      <p className="mt-auto pt-4 text-center text-xs text-muted-light">
        Polling cada 5s · DB: SQLite · QR para el puesto
      </p>
    </main>
  );
}
