"use client";

import { useState } from "react";
import { usePollar } from "@pollar/react";
import { Button } from "@/components/ui/Button";
import { useBalance } from "@/hooks/useBalance";
import {
  currencyOf,
  paymentAssetFrom,
  type PaymentAsset,
  type PaymentResult,
} from "@/lib/payments";

export type { PaymentAsset, PaymentResult };

/**
 * The SDK types `result.message`/`.details` as `string`, but a server-side
 * validation failure (e.g. a Zod issue) can put a plain object there instead
 * — rendering that directly as JSX crashes the whole page (React error #31).
 * Guard against any non-string shape, not just this one case.
 */
function errorMessageFrom(value: unknown): string {
  return typeof value === "string" && value
    ? value
    : "The payment didn't go through. Check the address and your balance, then try again.";
}

interface PayButtonProps {
  /** Decimal string, e.g. "10.50". */
  amount: string;
  /** Recipient's Stellar address (G…), the id Pollar uses for accounts. */
  recipient: string;
  asset?: PaymentAsset;
  /** Text memo attached to the payment — e.g. binding it to a goal so the server can verify it wasn't recorded against a different one. */
  memo?: string;
  label?: string;
  /** Fires on confirmed ('success') and network-accepted ('pending') payments. */
  onSuccess?: (result: PaymentResult) => void;
}

type PayStep =
  | { step: "idle" }
  | { step: "confirming" }
  | { step: "processing" }
  | { step: "success"; hash: string }
  | { step: "error"; message: string };

/**
 * One-tap payment from the logged-in user's wallet to `recipient`.
 *
 * Pollar has no separate merchant "charge" API: an in-app purchase IS a
 * user-to-user Stellar payment from the user's wallet to the app's (or
 * another user's) address, so that is the flow implemented here via
 * `runTx('payment', …)`, the SDK's one-shot build-sign-submit helper.
 */
export function PayButton({
  amount,
  recipient,
  asset,
  memo,
  label,
  onSuccess,
}: PayButtonProps) {
  const { isAuthenticated, verified, runTx } = usePollar();
  const { asset: appAsset } = useBalance();
  const [state, setState] = useState<PayStep>({ step: "idle" });

  // When no asset is given, use the app's primary asset from the balance.
  const payAsset: PaymentAsset = asset ?? paymentAssetFrom(appAsset);
  const currency = currencyOf(payAsset);

  async function pay() {
    setState({ step: "processing" });
    try {
      const result = await runTx(
        "payment",
        { destination: recipient, amount, asset: payAsset },
        memo ? { memo: { type: "text", value: memo } } : undefined
      );
      if (result.status === "error") {
        setState({
          step: "error",
          message: errorMessageFrom(result.message ?? result.details),
        });
        return;
      }
      // BalanceCard refreshes on its own; it watches the SDK's global tx state.
      setState({ step: "success", hash: result.hash });
      onSuccess?.(result);
    } catch (err) {
      setState({
        step: "error",
        message:
          err instanceof Error
            ? err.message
            : "The payment didn't go through. Check your connection and try again.",
      });
    }
  }

  if (state.step === "confirming") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="text-sm text-muted">
          Pay <span className="font-mono font-semibold text-foreground">{amount} {currency}</span> to{" "}
          <span className="font-mono">{recipient.slice(0, 4)}…{recipient.slice(-4)}</span>?
        </span>
        <Button onClick={() => void pay()}>Confirm</Button>
        <Button variant="secondary" onClick={() => setState({ step: "idle" })}>
          Cancel
        </Button>
      </div>
    );
  }

  if (state.step === "success") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success-border bg-success-light px-4 py-3">
        <span className="text-sm font-medium text-success">
          ✓ Paid <span className="font-mono">{amount} {currency}</span>
        </span>
        <Button
          variant="ghost"
          onClick={() => setState({ step: "idle" })}
          className="px-3 py-1.5"
        >
          Pay again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        onClick={() => setState({ step: "confirming" })}
        disabled={!isAuthenticated || !verified}
        loading={state.step === "processing"}
      >
        {!isAuthenticated
          ? "Log in to pay"
          : state.step === "processing"
            ? "Processing…"
            : (label ?? (
                <>
                  Pay <span className="font-mono">{amount} {currency}</span>
                </>
              ))}
      </Button>
      {state.step === "error" && (
        <p className="rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
          {state.message}
        </p>
      )}
    </div>
  );
}
