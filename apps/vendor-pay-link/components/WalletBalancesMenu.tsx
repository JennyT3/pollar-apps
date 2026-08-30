"use client";

import { useEffect, useRef, useState } from "react";
import { usePollar } from "@pollar/react";
import { formatMoney } from "@/lib/format";

/**
 * Saldo simple en USDC. Sin XLM, sin swap, sin direcciones.
 */
export function WalletBalancesMenu() {
  const {
    isAuthenticated,
    verified,
    walletBalance,
    refreshWalletBalance,
    tx,
  } = usePollar();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated || !verified) return;
    if (walletBalance.step === "idle" || walletBalance.step === "error") {
      void refreshWalletBalance();
    }
  }, [isAuthenticated, verified, walletBalance.step, refreshWalletBalance]);

  useEffect(() => {
    if (tx.step === "success" || tx.step === "submitted") {
      void refreshWalletBalance();
    }
  }, [tx.step, refreshWalletBalance]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isAuthenticated) return null;

  const balances =
    walletBalance.step === "loaded" ? walletBalance.data.balances : [];
  const usd =
    balances.find(
      (b) =>
        b.type !== "native" &&
        (b.code === "USDC" || b.code === "USD")
    ) ?? balances.find((b) => b.enabledInApp && b.type !== "native");
  const loading =
    walletBalance.step === "loading" || walletBalance.step === "idle";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((v) => !v);
          void refreshWalletBalance();
        }}
        className="flex max-w-[10.5rem] items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:bg-surface-hover sm:max-w-none sm:px-3"
      >
        {loading && !usd ? (
          <span className="h-4 w-16 animate-pulse rounded bg-border" />
        ) : (
          <span className="truncate text-sm font-semibold tabular-nums">
            {formatMoney(usd?.balance ?? "0")}{" "}
            <span className="text-xs font-medium text-muted">USDC</span>
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Tu saldo"
          className="absolute right-0 z-30 mt-2 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
        >
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Tu saldo
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {formatMoney(usd?.balance ?? "0")}{" "}
              <span className="text-base font-semibold text-muted">USDC</span>
            </p>
          </div>
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => void refreshWalletBalance()}
              className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-surface hover:text-foreground"
            >
              Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

