"use client";

import { useState } from "react";
import { useUsdcAsset } from "@/hooks/useUsdcAsset";
import { useCasera, type MenuItem } from "../casera-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { adminHeaders } from "@/lib/fetch";

export default function CaseraMenuPage() {
  const { stall, adminToken, reload } = useCasera();
  const { currency, ready } = useUsdcAsset();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!stall) return null;

  const currencyLabel = currency ?? (ready ? "USDC" : "…");

  async function addItem() {
    if (!stall || !name.trim() || !price || !qty) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/stall/items", {
      method: "POST",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({
        stallId: stall.id,
        name: name.trim(),
        price: parseFloat(price),
        quantity: parseInt(qty, 10),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(`No se pudo agregar (${res.status} ${data.error ?? ""})`.trim());
      setBusy(false);
      return;
    }
    setName("");
    setPrice("");
    setQty("");
    setBusy(false);
    await reload();
  }

  async function toggleSoldOut(item: MenuItem) {
    if (!stall) return;
    const res = await fetch("/api/stall/items", {
      method: "PATCH",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ id: item.id, soldOut: !item.soldOut }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(`No se pudo actualizar (${res.status} ${data.error ?? ""})`.trim());
      return;
    }
    setMsg(null);
    await reload();
  }

  async function updateQty(item: MenuItem, next: number) {
    if (!stall || next < 0) return;
    if (next === 0) {
      await toggleSoldOut(item);
      return;
    }
    const res = await fetch("/api/stall/items", {
      method: "PATCH",
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ id: item.id, quantity: Math.min(next, 999) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(`No se pudo actualizar (${res.status} ${data.error ?? ""})`.trim());
      return;
    }
    setMsg(null);
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="font-semibold">Agregar a la lista del día</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Precio"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            inputMode="decimal"
            min="0"
            className="sm:w-24"
          />
          <Input
            placeholder="Cant."
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            type="number"
            inputMode="numeric"
            min="1"
            className="sm:w-20"
          />
        </div>
        <Button
          onClick={() => void addItem()}
          disabled={!name.trim() || !price || !qty}
          loading={busy}
          className="mt-3"
        >
          Agregar
        </Button>
        {msg && <p className="mt-2 text-sm text-error">{msg}</p>}
      </Card>

      {ready && !currency && stall.items.length > 0 && (
        <div className="rounded-2xl border border-warning-border bg-warning-light px-4 py-3 text-sm text-warning">
          No se encontró USDC en tus balances. Los precios son en USDC: recibí
          algo de USDC para que tus clientes puedan pagar.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {stall.items.length === 0 && (
          <Card className="p-4 text-center">
            <p className="text-sm text-muted">
              Tu lista del día está vacía. Agregá el primer producto.
            </p>
          </Card>
        )}
        {stall.items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`font-medium ${item.soldOut ? "line-through text-muted" : ""}`}
                >
                  {item.name}
                </p>
                <p className="font-mono text-sm text-muted">
                  {item.price} {currencyLabel} · {item.quantity} disponibles
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {!item.soldOut && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      onClick={() => void updateQty(item, item.quantity - 1)}
                      className="h-8 w-8 px-0"
                      aria-label="Reducir cantidad"
                    >
                      −
                    </Button>
                    <span className="w-6 text-center font-mono text-sm">
                      {item.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => void updateQty(item, item.quantity + 1)}
                      className="h-8 w-8 px-0"
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </Button>
                  </div>
                )}
                <Button
                  variant={item.soldOut ? "secondary" : "ghost"}
                  onClick={() => void toggleSoldOut(item)}
                  className="px-3 py-1.5 text-xs"
                >
                  {item.soldOut ? "Reponer" : "Se acabó"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}