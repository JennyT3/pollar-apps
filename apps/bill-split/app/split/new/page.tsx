"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useBalance } from "@/hooks/useBalance";
import { currencyOf, paymentAssetFrom } from "@/lib/payments";
import { computeEqualShares } from "@/lib/split";

interface ParticipantDraft {
  label: string;
  shareAmount: string;
}

export default function NewSplitPage() {
  const { user } = usePollarAuth();
  const { asset } = useBalance();
  const router = useRouter();

  const payAsset = paymentAssetFrom(asset);
  const currency = currencyOf(payAsset);

  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    { label: "", shareAmount: "" },
    { label: "", shareAmount: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <PollarLogo size={72} />
        <h1 className="text-2xl font-bold">Split a bill</h1>
        <p className="text-sm leading-6 text-muted">Log in to create a split.</p>
        <LoginButton />
      </main>
    );
  }

  const totalValid = /^\d+(\.\d{1,2})?$/.test(totalAmount) && Number(totalAmount) > 0;
  const labelsValid = participants.every((p) => p.label.trim().length > 0);
  const sharesSum = participants.reduce((sum, p) => sum + Number(p.shareAmount || 0), 0);
  const customSumValid =
    mode === "custom" &&
    totalValid &&
    Math.abs(sharesSum - Number(totalAmount)) < 0.01 &&
    participants.every((p) => Number(p.shareAmount) > 0);

  const formValid =
    description.trim().length > 0 &&
    totalValid &&
    participants.length >= 1 &&
    labelsValid &&
    (mode === "equal" || customSumValid);

  function updateParticipant(index: number, patch: Partial<ParticipantDraft>) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { label: "", shareAmount: "" }]);
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!user || !formValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const shares =
        mode === "equal"
          ? computeEqualShares(totalAmount, participants.length)
          : participants.map((p) => p.shareAmount);

      const res = await fetch("/api/splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          totalAmount,
          assetCode: currency,
          assetIssuer: payAsset.type === "native" ? "native" : payAsset.issuer,
          collectorAddress: user.address,
          participants: participants.map((p, i) => ({
            label: p.label.trim(),
            shareAmount: shares[i],
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create the split.");
      }
      const data = await res.json();
      router.push(`/split/${data.split.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the split.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-2">
        <BackLink />
        <h1 className="text-xl font-bold">Split a bill</h1>
      </div>
      <p className="-mt-3 text-sm leading-6 text-muted">
        Set the total, add who&apos;s in, and share the link or QR so everyone
        can pay their share.
      </p>

      <Card className="flex flex-col gap-4 p-4">
        <Input
          label="What's it for?"
          placeholder="Dinner at..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          label={`Total (${currency})`}
          inputMode="decimal"
          placeholder="0.00"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value.replace(",", "."))}
        />
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Participants</span>
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <button
              onClick={() => setMode("equal")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                mode === "equal"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Equal
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                mode === "custom"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {participants.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder={`Person ${i + 1}`}
              value={p.label}
              onChange={(e) => updateParticipant(i, { label: e.target.value })}
              className="flex-1"
            />
            {mode === "custom" && (
              <Input
                placeholder="0.00"
                inputMode="decimal"
                value={p.shareAmount}
                onChange={(e) =>
                  updateParticipant(i, {
                    shareAmount: e.target.value.replace(",", "."),
                  })
                }
                className="w-24 font-mono"
              />
            )}
            {participants.length > 1 && (
              <button
                onClick={() => removeParticipant(i)}
                aria-label="Remove"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-error"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <Button variant="ghost" onClick={addParticipant} className="self-start">
          + Add person
        </Button>

        {mode === "custom" && totalValid && (
          <p
            className={`text-sm ${
              customSumValid ? "text-muted" : "text-error"
            }`}
          >
            Shares add up to {sharesSum.toFixed(2)} {currency} (total is{" "}
            {Number(totalAmount).toFixed(2)} {currency})
          </p>
        )}
      </Card>

      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <Button
        onClick={() => void submit()}
        disabled={!formValid}
        loading={submitting}
        className="w-full py-3"
      >
        Create split
      </Button>
    </main>
  );
}
