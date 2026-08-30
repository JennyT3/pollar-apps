"use client";

import { useState } from "react";
import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useBalance } from "@/hooks/useBalance";
import { formatAmount } from "@/lib/format";

/**
 * Spike checklist page — reproduce the charging loop on testnet before the
 * full product walkthrough. Capture both tx hashes here after buyer pays.
 */
export default function SpikePage() {
  const { user } = usePollarAuth();
  const { balance, currency } = useBalance();
  const [hashes, setHashes] = useState({ fixed: "", open: "" });
  const [notes, setNotes] = useState("");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-semibold text-primary">
            ← App
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Spike: loop de cobro
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Criterio bloqueante: dos cuentas Pollar en testnet, QR de monto fijo
            y QR abierto, pago con una confirmación, detección + hash en el
            historial del vendedor.
          </p>
        </div>
        <LoginButton />
      </header>

      {user && (
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
          <p>
            Cuenta activa:{" "}
            <span className="font-mono text-xs">{user.address}</span>
          </p>
          <p className="mt-1">
            Saldo:{" "}
            <span className="font-mono font-semibold">
              {formatAmount(balance)} {currency}
            </span>
          </p>
        </div>
      )}

      <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm leading-6">
        <li>
          Abre esta app en dos navegadores (o normal + incógnito). En uno iniciá
          sesión como <strong>vendedor</strong>, en el otro como{" "}
          <strong>comprador</strong>. Fondea USDC de testnet en el comprador.
        </li>
        <li>
          Como vendedor: nombra el puesto en la home. Abre{" "}
          <Link href="/print" className="font-semibold text-primary underline">
            /print
          </Link>{" "}
          y verifica la vista imprimible del QR permanente.
        </li>
        <li>
          <strong>QR abierto (puesto):</strong> el comprador escanea o abre{" "}
          <code className="rounded bg-surface px-1 font-mono text-xs">
            /pay/s/&lt;código&gt;
          </code>
          , escribe un monto (ej. 1.25), confirma y paga. Anota el hash abajo.
        </li>
        <li>
          <strong>QR fijo (por venta):</strong> el vendedor genera un cobro con
          monto + nota (dos toques). El comprador escanea el QR del modal, paga
          y anota el segundo hash.
        </li>
        <li>
          En la pestaña <em>Ventas de hoy</em> del vendedor deberían aparecer
          ambas ventas con hash. Cada hash abre en{" "}
          <a
            href="https://stellar.expert/explorer/testnet"
            className="text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            stellar.expert (testnet)
          </a>
          .
        </li>
      </ol>

      <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <h2 className="text-lg font-bold">Hashes del spike</h2>
        <label className="flex flex-col gap-1 text-sm">
          Hash — cobro fijo
          <input
            className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
            value={hashes.fixed}
            onChange={(e) =>
              setHashes((h) => ({ ...h, fixed: e.target.value.trim() }))
            }
            placeholder="64 hex chars"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hash — monto abierto (puesto)
          <input
            className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
            value={hashes.open}
            onChange={(e) =>
              setHashes((h) => ({ ...h, open: e.target.value.trim() }))
            }
            placeholder="64 hex chars"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Notas / hallazgos
          <textarea
            className="min-h-24 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="¿Prefill del pago desde QR? ¿Detección del ingreso? Documenta sorpresas aquí."
          />
        </label>
        <p className="text-xs text-muted">
          Prefill: los links{" "}
          <code className="font-mono">/pay/s/…</code> y{" "}
          <code className="font-mono">/pay/c/…</code> abren la app con el
          destinatario (y el monto, si es fijo) ya listos — el comprador no
          escribe una dirección G…. Detección: callback del comprador al pagar
          (primario) + polling de{" "}
          <code className="font-mono">fetchTxHistory</code>; el servidor
          verifica cada hash en Horizon (destino, monto, memo{" "}
          <code className="font-mono">P-{"{saleId}"}</code>). Ver README.
        </p>
      </section>
    </main>
  );
}
