"use client";

import { useEffect, useRef } from "react";
import { usePollar } from "@pollar/react";
import type { WalletBalanceRecord } from "@pollar/core";

function primaryRecord(
  balances: WalletBalanceRecord[]
): WalletBalanceRecord | null {
  return (
    balances.find((b) => b.enabledInApp && b.type !== "native") ??
    balances.find((b) => b.type === "native") ??
    balances[0] ??
    null
  );
}

export function useBalance(): {
  balance: string | null;
  currency: string | null;
  asset: WalletBalanceRecord | null;
  assets: WalletBalanceRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { isAuthenticated, verified, walletBalance, refreshWalletBalance } =
    usePollar();
  const retriedAfterVerify = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !verified) return;
    if (walletBalance.step === "idle") {
      void refreshWalletBalance();
    } else if (walletBalance.step === "error" && !retriedAfterVerify.current) {
      retriedAfterVerify.current = true;
      void refreshWalletBalance();
    }
  }, [isAuthenticated, verified, walletBalance.step, refreshWalletBalance]);

  const balances = walletBalance.step === "loaded" ? walletBalance.data.balances : [];
  const asset = primaryRecord(balances);

  return {
    balance: asset?.balance ?? null,
    currency: asset?.code ?? null,
    asset,
    assets: balances,
    isLoading:
      walletBalance.step === "loading" ||
      (isAuthenticated && walletBalance.step === "idle"),
    error: walletBalance.step === "error" ? walletBalance.message : null,
    refresh: refreshWalletBalance,
  };
}
