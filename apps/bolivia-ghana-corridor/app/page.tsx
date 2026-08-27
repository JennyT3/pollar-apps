"use client";

import { useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import type { RampQuote } from "@pollar/core";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { LoginButton } from "@/components/LoginButton";
import { ScannablePayment } from "@/components/ScannablePayment";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { upsertHistory, type CorridorStatus } from "@/lib/history";
import {
  isFiatRailDeposit,
  stellarPaymentOf,
  toGhanaInternationalPhone,
  type BridgeExecuteResult,
  type BridgeQuote,
  type BridgeResult,
  type BridgeStellarPayment,
} from "@/lib/morapay/types";

type Step =
  | "form"
  | "bridge-quoted"
  | "ramp-quotes"
  | "ramp-fields"
  | "ramp-processing"
  | "bridge-polling"
  | "done";

const RAMP_TERMINAL = ["completed", "failed"];
const BRIDGE_TERMINAL: readonly string[] = ["COMPLETED", "FAILED", "EXPIRED"];
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 90; // ~7.5 min at 5s — long enough for a real payout, not indefinite

async function callMorapay<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/morapay/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? `Morapay request to ${path} failed`);
  return json.data as T;
}

/**
 * Bolivia (BOB) -> Ghana (GHS) corridor, one direction shipped first per the
 * issue's own allowance. Three legs, each independently confirmed:
 *
 *   1. Morapay bridge quote + execute (pricing, MoMo recipient)
 *   2. Our own Pollar onramp, pointed at the Stellar address Morapay's
 *      execute call returned -- this is what generates the real Bolivia QR
 *      the payer scans and pays BOB against (the "DIY" path from Morapay's
 *      own integration docs: they don't yet support hosting that QR
 *      themselves from a backend without an interactive OTP session).
 *   3. Morapay bridge confirm + status poll, once the onramp hands back a
 *      Stellar tx hash -- this is what triggers the GHS MoMo payout.
 */
export default function Home() {
  const { user } = usePollarAuth();
  const { getClient } = usePollar();

  const [step, setStep] = useState<Step>("form");

  const [amount, setAmount] = useState("100");
  const [momoPhone, setMomoPhone] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoProvider, setMomoProvider] = useState("mtn");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [bridgeQuote, setBridgeQuote] = useState<BridgeQuote | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeErr, setExecuteErr] = useState<string | null>(null);
  const [hostedPayment, setHostedPayment] = useState<Record<string, unknown> | null>(null);
  const [stellarTarget, setStellarTarget] = useState<BridgeStellarPayment | null>(null);

  const [rampQuotes, setRampQuotes] = useState<RampQuote[]>([]);
  const [rampQuotesLoading, setRampQuotesLoading] = useState(false);
  const [rampQuotesErr, setRampQuotesErr] = useState<string | null>(null);
  const [selectedRampQuote, setSelectedRampQuote] = useState<RampQuote | null>(null);
  const [rampFieldValues, setRampFieldValues] = useState<Record<string, string>>({});
  const [rampSubmitting, setRampSubmitting] = useState(false);
  const [rampSubmitErr, setRampSubmitErr] = useState<string | null>(null);
  const [rampTxId, setRampTxId] = useState<string | null>(null);
  const [rampTxStatus, setRampTxStatus] = useState<string | null>(null);
  const [rampDepositInstructions, setRampDepositInstructions] = useState<Record<string, unknown> | null>(null);
  const [rampPollErr, setRampPollErr] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);
  const [bridgePollErr, setBridgePollErr] = useState<string | null>(null);

  function recordHistory(status: CorridorStatus, extra?: Partial<Parameters<typeof upsertHistory>[0]>) {
    if (!bridgeQuote) return;
    upsertHistory({
      id: bridgeQuote.quoteId,
      createdAt: Date.now(),
      sourceCurrency: bridgeQuote.source.currency,
      sourceAmount: bridgeQuote.source.amount,
      destCurrency: bridgeQuote.destination.currency,
      destAmount: bridgeQuote.destination.amount,
      status,
      ...extra,
    });
  }

  async function fetchBridgeQuote() {
    setFormErr(null);
    if (!momoPhone.trim() || !momoName.trim()) {
      setFormErr("Ghana recipient phone and name are required.");
      return;
    }
    setQuoting(true);
    try {
      const quote = await callMorapay<BridgeQuote>("bridge/quote", {
        direction: "PESOS_TO_GHS",
        sourceCurrency: "BOB",
        sourceAmount: Number(amount),
      });
      setBridgeQuote(quote);
      upsertHistory({
        id: quote.quoteId,
        createdAt: Date.now(),
        sourceCurrency: quote.source.currency,
        sourceAmount: quote.source.amount,
        destCurrency: quote.destination.currency,
        destAmount: quote.destination.amount,
        status: "QUOTED",
      });
      setStep("bridge-quoted");
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Could not get a quote");
    } finally {
      setQuoting(false);
    }
  }

  async function executeBridge() {
    if (!bridgeQuote) return;
    setExecuteErr(null);
    setExecuting(true);
    try {
      const result = await callMorapay<BridgeExecuteResult>("bridge/execute", {
        quoteId: bridgeQuote.quoteId,
        momo: {
          phone: toGhanaInternationalPhone(momoPhone),
          receiverName: momoName,
          providerHint: momoProvider || undefined,
        },
      });
      recordHistory(result.status as CorridorStatus);

      if (isFiatRailDeposit(result.payment) && result.payment.scannable) {
        // Morapay hosts the fiat QR itself for this transfer -- nothing left
        // for us to drive on the crypto leg, just wait for their webhook/poll.
        setHostedPayment(result.payment as unknown as Record<string, unknown>);
        setStep("bridge-polling");
        return;
      }

      const stellar = stellarPaymentOf(result.payment);
      if (!stellar) throw new Error("Execute response had no payment instructions we can use.");
      setStellarTarget(stellar);
      setStep("ramp-quotes");
      await fetchRampQuotes();
    } catch (err) {
      setExecuteErr(err instanceof Error ? err.message : "Could not start the transfer");
    } finally {
      setExecuting(false);
    }
  }

  async function fetchRampQuotes() {
    if (!bridgeQuote) return;
    setRampQuotesErr(null);
    setRampQuotesLoading(true);
    try {
      const client = getClient();
      const result = await client.getRampsQuote({
        country: "BO",
        currency: "BOB",
        amount: Number(bridgeQuote.source.amount),
        direction: "onramp",
      });
      const list = result.quotes ?? [];
      setRampQuotes(list);
      if (!list.length) setRampQuotesErr("No Bolivia onramp routes are available right now.");
    } catch (err: unknown) {
      const anyErr = err as { responseBody?: { details?: string }; message?: string };
      setRampQuotesErr(anyErr.responseBody?.details ?? anyErr.message ?? "Could not fetch Bolivia onramp routes.");
    } finally {
      setRampQuotesLoading(false);
    }
  }

  function selectRampQuote(quote: RampQuote) {
    setSelectedRampQuote(quote);
    const defaults: Record<string, string> = {};
    for (const f of quote.requiredFields ?? []) defaults[f.key] = f.options?.[0]?.value ?? "";
    setRampFieldValues(defaults);
    setRampSubmitErr(null);
    setStep("ramp-fields");
  }

  async function submitRampOrder() {
    if (!selectedRampQuote || !stellarTarget || !bridgeQuote) return;
    setRampSubmitErr(null);
    setRampSubmitting(true);
    try {
      const client = getClient();
      const params: Record<string, unknown> = {
        quoteId: selectedRampQuote.quoteId,
        amount: Number(bridgeQuote.source.amount),
        currency: "BOB",
        country: "BO",
        // The whole point of the DIY path: USDC lands directly at Morapay's
        // address, never touching this app's own Pollar balance.
        walletAddress: stellarTarget.destination,
      };
      for (const f of selectedRampQuote.requiredFields ?? []) {
        const val = rampFieldValues[f.key];
        if (val) params[f.key] = val;
      }
      const response = await client.createOnRamp(params as Parameters<typeof client.createOnRamp>[0]);
      setRampTxId(response.txId);
      setRampTxStatus(response.status);
      if (response.depositInstructions) setRampDepositInstructions(response.depositInstructions);
      recordHistory("AWAITING_CRYPTO");
      setStep("ramp-processing");
    } catch (err: unknown) {
      const anyErr = err as { responseBody?: { details?: string }; message?: string };
      setRampSubmitErr(anyErr.responseBody?.details ?? anyErr.message ?? "Could not start the Bolivia payment.");
    } finally {
      setRampSubmitting(false);
    }
  }

  // Declared before the effect below that calls it, so the effect's
  // dependency on this function is an actual reference, not a forward one.
  async function confirmBridge(hash: string) {
    if (!bridgeQuote) return;
    setConfirming(true);
    setConfirmErr(null);
    try {
      const result = await callMorapay<BridgeResult>("bridge/confirm", {
        bridgeTransferId: bridgeQuote.quoteId,
        stellarTxHash: hash,
      });
      setBridgeResult(result);
      recordHistory(result.status as CorridorStatus, {
        stellarTxHash: hash,
        momoReference: result.momoReference,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
      });
      setStep(BRIDGE_TERMINAL.includes(result.status) ? "done" : "bridge-polling");
    } catch (err) {
      // The on-chain leg is real and confirmed on Horizon either way -- a
      // failure here means Morapay hasn't yet recorded it, not that the
      // payment didn't happen. Surface it distinctly so nobody re-pays.
      setConfirmErr(
        err instanceof Error
          ? `On-chain payment succeeded (${hash.slice(0, 8)}...) but confirming it with Morapay failed: ${err.message}`
          : "On-chain payment succeeded, but confirming it with Morapay failed.",
      );
      setStep("bridge-polling");
    } finally {
      setConfirming(false);
    }
  }

  // Poll the Bolivia-side onramp until Pollar hands back a Stellar tx hash,
  // then immediately confirm that leg with Morapay.
  useEffect(() => {
    if (step !== "ramp-processing" || !rampTxId) return;
    if (rampTxStatus && RAMP_TERMINAL.includes(rampTxStatus)) return;
    let active = true;
    let attempts = 0;
    const client = getClient();
    const id = setInterval(async () => {
      attempts += 1;
      try {
        const tx = await client.getRampTransaction(rampTxId);
        if (!active) return;
        setRampTxStatus(tx.status);
        setRampPollErr(null);
        if (tx.depositInstructions) setRampDepositInstructions(tx.depositInstructions);
        if (tx.stellarTxHash) {
          clearInterval(id);
          void confirmBridge(tx.stellarTxHash);
        } else if (RAMP_TERMINAL.includes(tx.status)) {
          clearInterval(id);
        }
      } catch (err: unknown) {
        if (!active) return;
        const anyErr = err as { responseBody?: { details?: string }; message?: string };
        setRampPollErr(anyErr.responseBody?.details ?? anyErr.message ?? "Status check failed.");
      }
      if (attempts >= POLL_MAX_ATTEMPTS && active) clearInterval(id);
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rampTxId, rampTxStatus]);

  // Poll the Morapay side (fiat payout leg) until it reaches a terminal
  // status. Covers both the hosted-QR path (nothing else to drive on our
  // end) and the DIY path once confirm has been called.
  useEffect(() => {
    if (step !== "bridge-polling" || !bridgeQuote) return;
    // Already terminal by the time this effect runs (e.g. confirmBridge just
    // set it) -- nothing to poll. The transition to "done" already happened
    // wherever that terminal result was first observed, not here.
    if (bridgeResult && BRIDGE_TERMINAL.includes(bridgeResult.status)) return;
    let active = true;
    let attempts = 0;
    const id = setInterval(async () => {
      attempts += 1;
      try {
        const result = await callMorapay<BridgeResult>(`bridge/status/${bridgeQuote.quoteId}`);
        if (!active) return;
        setBridgeResult(result);
        setBridgePollErr(null);
        recordHistory(result.status as CorridorStatus, {
          stellarTxHash: result.stellarTxHash,
          momoReference: result.momoReference,
          failureCode: result.failureCode,
          failureMessage: result.failureMessage,
        });
        if (BRIDGE_TERMINAL.includes(result.status)) {
          clearInterval(id);
          setStep("done");
        }
      } catch (err) {
        if (!active) return;
        setBridgePollErr(err instanceof Error ? err.message : "Status check failed.");
      }
      if (attempts >= POLL_MAX_ATTEMPTS && active) clearInterval(id);
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, bridgeQuote, bridgeResult]);

  function startOver() {
    setStep("form");
    setBridgeQuote(null);
    setExecuteErr(null);
    setHostedPayment(null);
    setStellarTarget(null);
    setRampQuotes([]);
    setSelectedRampQuote(null);
    setRampFieldValues({});
    setRampTxId(null);
    setRampTxStatus(null);
    setRampDepositInstructions(null);
    setRampPollErr(null);
    setConfirmErr(null);
    setBridgeResult(null);
    setBridgePollErr(null);
  }

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Bolivia <span className="text-primary">&rarr;</span> Ghana
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Send BOB from Bolivia, land GHS in a Ghanaian mobile money account.
            Log in to start a transfer.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 lg:max-w-lg lg:py-10">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
            Bolivia &rarr; Ghana
          </h1>
        </div>
        <LoginButton />
      </header>

      {step === "form" && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Send BOB, pay out GHS</h2>
          <Input
            label="Amount (BOB)"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            label="Recipient phone (Ghana)"
            placeholder="0241234567"
            value={momoPhone}
            onChange={(e) => setMomoPhone(e.target.value)}
          />
          <Input
            label="Recipient name"
            value={momoName}
            onChange={(e) => setMomoName(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Mobile money provider</label>
            <select
              value={momoProvider}
              onChange={(e) => setMomoProvider(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="mtn">MTN</option>
              <option value="vodafone">Telecel (Vodafone)</option>
              <option value="airteltigo">AirtelTigo</option>
            </select>
          </div>
          {formErr && <p className="text-sm text-error">{formErr}</p>}
          <Button onClick={() => void fetchBridgeQuote()} loading={quoting}>
            Get quote
          </Button>
        </Card>
      )}

      {step === "bridge-quoted" && bridgeQuote && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Confirm transfer</h2>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">You send</span>
              <span className="font-mono font-semibold">
                {bridgeQuote.source.amount} {bridgeQuote.source.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Recipient gets</span>
              <span className="font-mono font-semibold">
                {bridgeQuote.destination.amount} {bridgeQuote.destination.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Bridged as</span>
              <span className="font-mono">{bridgeQuote.bridge.amount} USDC (Stellar)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Quote expires</span>
              <span className="font-mono">{new Date(bridgeQuote.expiresAt).toLocaleTimeString()}</span>
            </div>
          </div>
          {executeErr && <p className="text-sm text-error">{executeErr}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={startOver}>
              Cancel
            </Button>
            <Button onClick={() => void executeBridge()} loading={executing} className="flex-1">
              Start transfer
            </Button>
          </div>
        </Card>
      )}

      {step === "ramp-quotes" && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Choose how to pay in Bolivia</h2>
          {rampQuotesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Looking up BOB payment routes...
            </div>
          )}
          {rampQuotesErr && <p className="text-sm text-error">{rampQuotesErr}</p>}
          <div className="flex flex-col gap-2">
            {rampQuotes.map((q) => (
              <button
                key={q.quoteId}
                onClick={() => selectRampQuote(q)}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left hover:border-primary/40"
              >
                <span className="text-sm font-semibold">{q.provider}</span>
                <span className="font-mono text-xs text-muted">{q.rail} &middot; {q.estimatedTime}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "ramp-fields" && selectedRampQuote && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Payer details</h2>
          {(selectedRampQuote.requiredFields ?? []).map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              {f.type === "select" ? (
                <>
                  <label className="text-sm font-medium text-foreground">{f.label}</label>
                  <select
                    value={rampFieldValues[f.key] ?? ""}
                    onChange={(e) => setRampFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <Input
                  label={f.label}
                  type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                  value={rampFieldValues[f.key] ?? ""}
                  onChange={(e) => setRampFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {rampSubmitErr && <p className="text-sm text-error">{rampSubmitErr}</p>}
          <Button onClick={() => void submitRampOrder()} loading={rampSubmitting}>
            Generate Bolivia QR
          </Button>
        </Card>
      )}

      {step === "ramp-processing" && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Scan and pay in Bolivia</h2>
          <p className="text-sm text-muted">
            Status: <span className="font-mono">{rampTxStatus ?? "pending"}</span>
          </p>
          {rampDepositInstructions && <ScannablePayment data={rampDepositInstructions} />}
          {rampPollErr && <p className="text-sm text-error">{rampPollErr}</p>}
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Waiting for the BOB payment to land as USDC...
          </div>
        </Card>
      )}

      {step === "bridge-polling" && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Scan and pay in Bolivia</h2>
          {hostedPayment && <ScannablePayment data={hostedPayment} />}
          {confirming && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Confirming the on-chain payment with Morapay...
            </div>
          )}
          {confirmErr && <p className="text-sm text-error">{confirmErr}</p>}
          <p className="text-sm text-muted">
            Status: <span className="font-mono">{bridgeResult?.status ?? "AWAITING_CRYPTO"}</span>
          </p>
          {bridgePollErr && <p className="text-sm text-error">{bridgePollErr}</p>}
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Waiting for the GHS mobile money payout...
          </div>
        </Card>
      )}

      {step === "done" && bridgeResult && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">
            {bridgeResult.status === "COMPLETED" ? "Transfer complete" : "Transfer did not complete"}
          </h2>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Status</span>
              <span className="font-mono font-semibold">{bridgeResult.status}</span>
            </div>
            {bridgeResult.momoReference && (
              <div className="flex justify-between">
                <span className="text-muted">MoMo reference</span>
                <span className="font-mono">{bridgeResult.momoReference}</span>
              </div>
            )}
            {bridgeResult.failureMessage && (
              <div className="flex flex-col gap-1 pt-2">
                <span className="text-error">{bridgeResult.failureMessage}</span>
                {bridgeResult.failureCode === "MOMO_PAYOUT_FAILED" && (
                  <span className="text-xs text-muted">
                    The on-chain leg already succeeded -- the crypto is with Morapay. This is a payout-side
                    failure only; it does not mean the transfer needs to be retried from scratch.
                  </span>
                )}
              </div>
            )}
          </div>
          <Button onClick={startOver}>Start another transfer</Button>
        </Card>
      )}

      <p className="mt-auto pt-4 text-center text-xs text-muted-light">
        Bolivia (BOB) &rarr; Ghana (GHS) corridor, built on the Morapay bridge and Pollar&apos;s ramp SDK.
      </p>
    </main>
  );
}
