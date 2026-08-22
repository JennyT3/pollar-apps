"use client";

import { useMemo, useState } from "react";
import { usePollar } from "@pollar/react";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useBalance } from "@/hooks/useBalance";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount } from "@/lib/format";
import { fromCents, multiply, sum, toCents } from "@/lib/money";
import type { CategoryWithItems } from "@/lib/queries";
import { explorerTxUrl, USDC } from "@/lib/stellar";

interface Props {
  restaurantName: string;
  tableLabel: string;
  tableCode: string;
  menu: CategoryWithItems[];
}

interface PlacedLine {
  name: string;
  price: string;
  quantity: number;
}

type Stage =
  | { step: "browsing" }
  | { step: "placing" }
  | { step: "paying"; total: string }
  | { step: "verifying"; total: string }
  | {
      step: "done";
      total: string;
      hash: string;
      memoId: number;
      lines: PlacedLine[];
    }
  | { step: "error"; message: string };

export function OrderFlow({ restaurantName, tableLabel, tableCode, menu }: Props) {
  const { user, verified } = usePollarAuth();
  const { asset, balance } = useBalance();
  const { runTx } = usePollar();

  const [qty, setQty] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<Stage>({ step: "browsing" });

  const lines = useMemo(
    () =>
      menu
        .flatMap((category) => category.items)
        .map((item) => ({ item, quantity: qty[item.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [menu, qty]
  );

  const total = lines.length
    ? sum(lines.map((line) => multiply(line.item.price, line.quantity)))
    : "0.00";
  const count = lines.reduce((acc, line) => acc + line.quantity, 0);

  // useBalance() falls back to native XLM before the app asset loads. Paying
  // an order in XLM instead of USDC would be silent and unrecoverable, so a
  // payment is only allowed once the real USDC record is in hand.
  const usdcReady = asset?.code === USDC.code && asset?.issuer === USDC.issuer;
  const shortOnFunds =
    usdcReady && balance !== null && Number(balance) < Number(total);

  async function placeAndPay() {
    setStage({ step: "placing" });
    try {
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode,
          items: lines.map((line) => ({
            itemId: line.item.id,
            quantity: line.quantity,
          })),
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Couldn't place the order.");

      const order = created.order as {
        id: string;
        memoId: number;
        total: string;
        payToAddress: string;
      };

      setStage({ step: "paying", total: order.total });

      // The order reference rides along as a Stellar MEMO_ID, which is what
      // ties this payment to this order on the ledger.
      const outcome = await runTx(
        "payment",
        {
          destination: order.payToAddress,
          amount: order.total,
          asset: { type: "credit_alphanum4", code: USDC.code, issuer: USDC.issuer },
        },
        { memo: { type: "id", value: String(order.memoId) } }
      );

      if (outcome.status === "error" || !outcome.hash) {
        throw new Error(
          outcome.status === "error"
            ? (outcome.message ?? outcome.details ?? "The payment didn't go through.")
            : "The payment returned no hash."
        );
      }

      setStage({ step: "verifying", total: order.total });

      const confirmRes = await fetch(`/api/orders/${order.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: outcome.hash }),
      });
      const confirmed = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmed.error ?? "The payment couldn't be verified.");
      }

      setStage({
        step: "done",
        total: order.total,
        hash: outcome.hash,
        memoId: order.memoId,
        // Snapshot for the receipt: the cart is cleared right after.
        lines: lines.map((line) => ({
          name: line.item.name,
          price: line.item.price,
          quantity: line.quantity,
        })),
      });
      setQty({});
    } catch (err) {
      setStage({
        step: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  if (stage.step === "done") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-3xl text-success">
            ✓
          </span>
          <h1 className="text-2xl font-bold tracking-tight">¡Pedido pagado!</h1>
          <p className="text-muted">
            Ya está en la cocina para {tableLabel}. No hace falta que avises a
            nadie.
          </p>
        </div>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Tu comprobante
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {stage.lines.map((line) => (
              <li
                key={line.name}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono font-semibold">{line.quantity}×</span>{" "}
                  {line.name}
                </span>
                <span className="font-mono text-muted">
                  {multiply(line.price, line.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-semibold">Total pagado</span>
            <span className="font-mono text-xl font-bold tabular-nums">
              {stage.total} {USDC.code}
            </span>
          </div>
          <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">N° de pedido</dt>
              <dd className="font-mono">{stage.memoId}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted">
                Comprobante en la blockchain — cualquiera lo puede verificar.
                Red de prueba (Stellar testnet).
              </dt>
              <dd>
                <a
                  href={explorerTxUrl(stage.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all font-mono text-primary underline"
                >
                  {stage.hash}
                </a>
              </dd>
            </div>
          </dl>
        </Card>

        <Button
          variant="secondary"
          onClick={() => setStage({ step: "browsing" })}
          className="w-full py-3"
        >
          Pedir algo más
        </Button>
      </main>
    );
  }

  const working =
    stage.step === "placing" || stage.step === "paying" || stage.step === "verifying";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5 pb-32">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {restaurantName}
          </h1>
          <p className="text-sm text-muted">{tableLabel}</p>
        </div>
        <LoginButton />
      </header>

      {/* Money on hand, before anything is chosen. A diner deciding what to
          order needs to know what they can afford; leaving it to the moment
          of payment turns a normal decision into a rejection. */}
      {user && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <span className="text-sm text-muted">Tu saldo</span>
          {usdcReady ? (
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatAmount(balance)} {USDC.code}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> preparando tu cuenta…
            </span>
          )}
        </div>
      )}

      {menu.length > 0 && (
        /* A diner who has never used this doesn't know what "Pagar" will do —
           whether a waiter comes, whether a card is needed. Saying it up front
           removes the hesitation. */
        <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-6 text-muted">
          Elegí lo que quieras y pagá desde tu celular con tu cuenta Pollar. El
          pedido llega a la cocina ya pagado, no hace falta llamar a nadie.
        </p>
      )}

      {menu.length === 0 ? (
        <EmptyState
          title="Hoy no hay nada cargado"
          description="El menú de este local todavía no tiene platos disponibles."
        />
      ) : (
        menu.map((category) => (
          <Card key={category.id}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              {category.name}
            </h2>
            <div className="mt-1 flex flex-col divide-y divide-border">
              {category.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  {item.photoUrl && (
                    /* Plain img on purpose: the URL is whatever the owner
                       pasted, so there is no host list to optimize against. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    {item.description && (
                      <p className="line-clamp-2 text-sm text-muted">
                        {item.description}
                      </p>
                    )}
                    <p className="font-mono text-sm text-muted">
                      {item.price} {USDC.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      className="h-10 w-10 justify-center p-0 text-lg"
                      aria-label={`Quitar uno de ${item.name}`}
                      onClick={() =>
                        setQty((q) => ({
                          ...q,
                          [item.id]: Math.max(0, (q[item.id] ?? 0) - 1),
                        }))
                      }
                    >
                      −
                    </Button>
                    <span className="w-5 text-center font-mono tabular-nums">
                      {qty[item.id] ?? 0}
                    </span>
                    <Button
                      variant="secondary"
                      className="h-10 w-10 justify-center p-0 text-lg"
                      aria-label={`Agregar uno de ${item.name}`}
                      onClick={() =>
                        setQty((q) => ({ ...q, [item.id]: (q[item.id] ?? 0) + 1 }))
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {stage.step === "error" && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {stage.message}
        </p>
      )}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">
                {count} {count === 1 ? "ítem" : "ítems"}
                {user && usdcReady && (
                  <>
                    {" · saldo "}
                    <span className="font-mono">
                      {formatAmount(balance)} {USDC.code}
                    </span>
                  </>
                )}
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {total} {USDC.code}
              </span>
            </div>

            {!user ? (
              <LoginButton />
            ) : !usdcReady ? (
              <p className="flex items-center justify-center gap-2 rounded-xl border border-warning-border bg-warning-light px-3 py-2.5 text-sm text-warning">
                <Spinner /> Preparando tu cuenta…
              </p>
            ) : shortOnFunds ? (
              <p className="rounded-xl border border-warning-border bg-warning-light px-3 py-2.5 text-center text-sm text-warning">
                Te faltan{" "}
                <span className="font-mono">
                  {fromCents(toCents(total) - toCents(balance ?? "0"))}{" "}
                  {USDC.code}
                </span>{" "}
                para este pedido. Sacá algo o cargá tu cuenta.
              </p>
            ) : (
              <Button
                onClick={() => void placeAndPay()}
                disabled={working || !verified}
                loading={working}
                className="w-full py-3.5 text-base"
              >
                {stage.step === "placing"
                  ? "Armando el pedido…"
                  : stage.step === "paying"
                    ? "Pagando…"
                    : stage.step === "verifying"
                      ? "Confirmando en la red…"
                      : `Pagar ${total} ${USDC.code}`}
              </Button>
            )}
            {/* The one person who most needs to know this is the one about to
                tap Pay, and they arrive straight here from the QR — they
                never see the landing page where it also says so. */}
            {user && (
              <p className="text-center text-xs text-muted-light">
                Red de prueba (Stellar testnet) · no se mueve dinero real
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
