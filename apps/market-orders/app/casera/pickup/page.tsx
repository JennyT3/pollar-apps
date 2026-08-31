"use client";

import { useState } from "react";
import { useCasera } from "../casera-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminHeaders } from "@/lib/fetch";

interface VerifyResult {
  ok: boolean;
  text: string;
  type: "ok" | "rejected" | "error";
}

const STELLAR_EXPLORER = "https://stellar.expert/explorer/testnet/tx";

function describe(code: string, res: Response, data: { reason?: string }): string {
  if (res.ok && data.reason === undefined && (data as { order?: unknown }).order) {
    return "ENTREGADO";
  }
  switch (data.reason) {
    case "already_delivered":
      return "RECHAZADO — este código ya fue entregado (409).";
    case "not_found":
      return "Código no encontrado.";
    case "not_authorized":
      return "No sos la casera de este puesto.";
    case "not_ready":
      return "La orden no está lista para entregar.";
    default:
      return `Error inesperado (${res.status}).`;
  }
}

export default function CaseraPickupPage() {
  const { stall, adminToken } = useCasera();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [deliveredOrder, setDeliveredOrder] = useState<{
    items: { name: string; quantity: number }[];
    txHash: string | null;
  } | null>(null);

  if (!stall) return null;

  async function verify() {
    const value = code.trim().toUpperCase();
    if (!value || !stall) return;
    setChecking(true);
    setResult(null);
    setDeliveredOrder(null);
    try {
      const res = await fetch("/api/pickup", {
        method: "POST",
        headers: adminHeaders(adminToken),
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setDeliveredOrder({
          items: data.order.items ?? [],
          txHash: data.order.txHash ?? null,
        });
        setResult({ ok: true, type: "ok", text: "ENTREGADO" });
      } else {
        setResult({
          ok: false,
          type: data.reason === "already_delivered" ? "rejected" : "error",
          text: describe(value, res, data),
        });
      }
    } catch {
      setResult({
        ok: false,
        type: "error",
        text: "Error de conexión. Probá de nuevo.",
      });
    }
    setChecking(false);
    setCode("");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="font-semibold">Verificar pickup</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Pedile al cliente su código de 6 caracteres. Un código ya entregado
          se rechaza (409): cada orden se entrega exactamente una vez.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            placeholder="Código"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 font-mono text-sm tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <Button onClick={() => void verify()} disabled={!code.trim()} loading={checking}>
            Verificar
          </Button>
        </div>
      </Card>

      {result && (
        <div
          className={`rounded-2xl border p-4 text-center text-sm font-medium ${
            result.type === "ok"
              ? "border-success-border bg-success-light text-success"
              : result.type === "rejected"
                ? "border-error-border bg-error-light text-error"
                : "border-warning-border bg-warning-light text-warning"
          }`}
        >
          <p className="text-lg font-bold">{result.text}</p>
          {deliveredOrder && (
            <div className="mt-2 text-sm">
              <p>{deliveredOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}</p>
              {deliveredOrder.txHash && (
                <a
                  href={`${STELLAR_EXPLORER}/${deliveredOrder.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-xs text-success underline"
                >
                  {deliveredOrder.txHash}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}