"use client";

import { useBalance } from "@/hooks/useBalance";
import { currencyOf, usdcPaymentAsset } from "@/lib/payments";

/**
 * This app is USDC-only: every price is shown and every payment is made in
 * USDC (testnet, verified on-chain server-side). This hook resolves the
 * logged-in wallet's USDC balance record and its asset code, and reports
 * whether the balance has loaded yet so the UI can distinguish "still
 * loading" from "USDC not available". It never falls back to XLM or to
 * another asset — callers must handle `payAsset === null`.
 */
export function useUsdcAsset() {
  const { assets, isLoading } = useBalance();
  const payAsset = usdcPaymentAsset(assets);
  return {
    payAsset,
    currency: payAsset ? currencyOf(payAsset) : null,
    /** False while the wallet balance is still loading. */
    ready: !isLoading,
  };
}