"use client";

import { useState, useEffect, use } from "react";
import { usePollar } from "@pollar/react";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useBalance } from "@/hooks/useBalance";
import { useUsdcAsset } from "@/hooks/useUsdcAsset";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { formatAmount } from "@/lib/format";
import { QRCodeSVG } from "qrcode.react";

interface Stall {
  id: string;
  name: string;
  ownerAddress: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    soldOut: boolean;
  }[];
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
}

export default function StallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = usePollarAuth();
  const { runTx } = usePollar();
  const { balance } = useBalance();
  const { payAsset, ready } = useUsdcAsset();
  // This app is USDC-only; the amount shown is always in USDC even while the
  // wallet's asset list is still loading.
  const currency = "USDC";

  const [stall, setStall] = useState<Stall | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"menu" | "confirm" | "paying" | "done" | "error">("menu");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/stall?id=${id}`);
        if (res.ok && !cancelled) {
          setStall(await res.json());
        }
      } catch {
        // stall not found view below
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function add(item: Stall["items"][0]) {
    if (item.soldOut || item.quantity <= 0) return;
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id);
      const inCart = ex?.qty ?? 0;
      if (inCart >= item.quantity) return prev;
      if (ex) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  }

  function remove(menuItemId: string) {
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === menuItemId);
      if (!ex) return prev;
      if (ex.qty <= 1) return prev.filter((c) => c.menuItemId !== menuItemId);
      return prev.map((c) =>
        c.menuItemId === menuItemId ? { ...c, qty: c.qty - 1 } : c
      );
    });
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  // USDC must be available on THIS account to pay; the server re-checks the
  // asset and issuer on-chain. Never pay in XLM or another asset.
  const canPay =
    user !== null && payAsset !== null && ready && total > 0;

  async function pay() {
    if (!user || !stall || total <= 0) return;
    if (!payAsset) {
      setErrMsg("Tu cuenta no tiene USDC disponible. Recargá USDC y probá de nuevo.");
      setStep("error");
      return;
    }
    setStep("paying");
    setErrMsg(null);

    try {
      const orderRes = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stallId: stall.id,
          customerAddress: user.address,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.qty,
          })),
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        setErrMsg(err.error ?? "No hay suficiente stock");
        setStep("error");
        return;
      }

      const order = await orderRes.json();
      const memo = order.memo;

      const res = await runTx(
        "payment",
        {
          destination: stall.ownerAddress,
          amount: order.total.toString(),
          asset: payAsset,
        },
        { memo: { type: "text", value: memo } }
      );

      if (res.status === "error") {
        setErrMsg(res.message ?? res.details ?? "El pago no se completó");
        setStep("error");
        return;
      }

      await fetch("/api/order/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status: "paid", txHash: res.hash }),
      });

      setTxHash(res.hash);
      setPickupCode(order.pickupCode);
      setPaidTotal(order.total);
      setStep("done");
      setCart([]);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "El pago no se completó");
      setStep("error");
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!stall) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
        <PollarLogo size={80} />
        <h1 className="text-2xl font-bold">Puesto no encontrado</h1>
        <p className="text-muted">Este puesto no existe o fue cerrado.</p>
      </main>
    );
  }

  const soldOutAll = stall.items.every(
    (i) => i.soldOut || i.quantity <= 0
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 lg:max-w-lg lg:py-10">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="min-w-0 truncate text-xl font-bold tracking-tight">
            {stall.name}
          </h1>
        </div>
        <LoginButton />
      </header>

      {soldOutAll && step === "menu" && (
        <div className="rounded-2xl border border-warning-border bg-warning-light px-4 py-3 text-sm text-warning">
          Hoy no quedan productos disponibles. Volvé mañana.
        </div>
      )}

      {step === "menu" && (
        <>
          <h2 className="font-semibold">Menú del día</h2>
          {stall.items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className={`font-medium ${item.soldOut ? "line-through text-muted" : ""}`}
                  >
                    {item.name}
                  </p>
                  <p className="font-mono text-sm text-muted">
                    {item.price} {currency}
                    {!item.soldOut && item.quantity > 0 && ` · ${item.quantity} disp.`}
                  </p>
                </div>
                {item.soldOut || item.quantity <= 0 ? (
                  <span className="text-xs font-medium text-muted">Agotado</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => remove(item.id)}
                      className="h-8 w-8 px-0"
                      aria-label="Quitar uno"
                    >
                      −
                    </Button>
                    <span className="w-6 text-center font-mono text-sm">
                      {cart.find((c) => c.menuItemId === item.id)?.qty ?? 0}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => add(item)}
                      className="h-8 w-8 px-0"
                      aria-label="Agregar uno"
                    >
                      +
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {cart.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium">Tu orden:</p>
              {cart.map((i) => (
                <div key={i.menuItemId} className="flex justify-between text-sm">
                  <span>
                    {i.qty}x {i.name}
                  </span>
                  <span className="font-mono">
                    {i.price * i.qty} {currency}
                  </span>
                </div>
              ))}
              <div className="mt-2 border-t border-border pt-2 font-bold">
                Total: {total} {currency}
              </div>
              {user && balance !== null && (
                <p className="mt-1 text-sm text-muted">
                  Tu saldo: {formatAmount(balance)} {currency}
                </p>
              )}
            </Card>
          )}

          {!user ? (
            <p className="text-center text-sm text-muted">
              Iniciá sesión con Pollar para pagar
            </p>
          ) : (
            <>
              {ready && !payAsset && (
                <div className="rounded-2xl border border-warning-border bg-warning-light px-4 py-3 text-sm text-warning">
                  Tu cuenta todavía no tiene USDC. Este puesto solo acepta
                  pagos en USDC — recibí USDC en tu cuenta y volvé a intentar.
                </div>
              )}
              <Button
                onClick={() => setStep("confirm")}
                disabled={cart.length === 0}
                className="w-full"
              >
                Pagar
              </Button>
            </>
          )}
        </>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">Confirmar:</p>
            {cart.map((i) => (
              <div key={i.menuItemId} className="flex justify-between text-sm">
                <span>
                  {i.qty}x {i.name}
                </span>
                <span className="font-mono">
                  {i.price * i.qty} {currency}
                </span>
              </div>
            ))}
            <div className="mt-2 border-t border-border pt-2 font-bold">
              Total: {total} {currency}
            </div>
            {user && balance !== null && (
              <p className="mt-1 text-sm text-muted">
                Tu saldo: {formatAmount(balance)} {currency}
              </p>
            )}
          </Card>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setStep("menu")}
              className="flex-1"
            >
              Volver
            </Button>
            <Button
              onClick={() => void pay()}
              className="flex-1"
              disabled={!canPay}
            >
              Confirmar pago
            </Button>
          </div>
        </div>
      )}

      {step === "paying" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted">Procesando pago...</p>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-success">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">Orden pagada</p>
            <p className="font-mono text-sm text-muted">
              {paidTotal ?? total} {currency}
            </p>
          </div>
          {pickupCode && (
            <Card className="w-full p-4 text-center">
              <p className="text-sm text-muted">Tu código de pickup:</p>
              <div className="my-4 flex justify-center">
                <QRCodeSVG value={pickupCode} size={160} />
              </div>
              <p className="font-mono text-3xl font-bold tracking-widest text-primary">
                {pickupCode}
              </p>
              <p className="mt-2 text-xs text-muted-light">
                Mostrá este código o escaneá el QR al recoger tu orden
              </p>
            </Card>
          )}
          {txHash && (
            <Card className="w-full p-4">
              <p className="text-xs text-muted">Hash:</p>
              <p className="break-all font-mono text-xs">{txHash}</p>
            </Card>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setStep("menu");
              setTxHash(null);
              setPickupCode(null);
              setPaidTotal(null);
            }}
          >
            Nueva orden
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-light">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-error">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-lg font-bold text-error">Error</p>
          <p className="text-sm text-muted">{errMsg}</p>
          <Button onClick={() => setStep("menu")}>Intentar de nuevo</Button>
        </div>
      )}

      <p className="mt-auto pt-4 text-center text-xs text-muted-light">
        {stall.name} · Pagar con Pollar en USDC
      </p>
    </main>
  );
}