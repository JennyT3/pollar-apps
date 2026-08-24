"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePollar } from "@pollar/react";
import { parseReceivedAmount } from "@/lib/parse-history";

/**
 * Polls Pollar tx history and POSTs candidate incoming payments to
 * `/api/sales/match` so pending sales get marked paid without vendor action.
 *
 * Limits (documented in README):
 * - History records expose `summary` + `hash`, not memo or counterparty.
 * - Matching is by amount against pending sales (oldest first).
 * - Primary confirmation is still the buyer's onSuccess callback.
 * - Only runs when the session is `verified` — otherwise refresh/history 401s spam.
 */
export function usePaymentDetection(
  vendorAddress: string | null,
  enabled: boolean,
  onMatched?: () => void
) {
  const { getClient, isAuthenticated, verified, txHistory } = usePollar();
  const onMatchedRef = useRef(onMatched);
  const sessionReady = isAuthenticated && verified;

  useEffect(() => {
    onMatchedRef.current = onMatched;
  }, [onMatched]);

  const matchFromHistory = useCallback(
    async (address: string) => {
      const state = getClient().getTxHistoryState();
      if (state.step !== "loaded") return;

      const incoming = state.data.records
        .filter((r) => r.status === "SUCCESS" || r.status === "PENDING")
        .map((r) => {
          const amount = parseReceivedAmount(r.summary);
          if (!amount) return null;
          return { hash: r.hash, amount, createdAt: r.createdAt };
        })
        .filter((x): x is { hash: string; amount: string; createdAt: string } =>
          Boolean(x)
        );

      if (incoming.length === 0) return;

      const res = await fetch("/api/sales/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorAddress: address, incoming }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { matched: unknown[] };
      if (data.matched?.length) onMatchedRef.current?.();
    },
    [getClient]
  );

  useEffect(() => {
    if (!enabled || !vendorAddress || !sessionReady) return;
    const client = getClient();
    void client.fetchTxHistory({ limit: 30, offset: 0 });
    const id = window.setInterval(() => {
      void client.fetchTxHistory({ limit: 30, offset: 0 });
    }, 8000);
    return () => window.clearInterval(id);
  }, [enabled, vendorAddress, sessionReady, getClient]);

  const historyStep = txHistory.step;
  const historyTotal = txHistory.step === "loaded" ? txHistory.data.total : 0;

  useEffect(() => {
    if (!enabled || !vendorAddress || !sessionReady) return;
    if (historyStep !== "loaded") return;
    void matchFromHistory(vendorAddress);
  }, [
    historyStep,
    historyTotal,
    enabled,
    vendorAddress,
    sessionReady,
    matchFromHistory,
  ]);
}
