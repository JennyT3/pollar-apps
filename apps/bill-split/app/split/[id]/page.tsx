"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePollar } from "@pollar/react";
import { BackLink } from "@/components/BackLink";
import { LoginButton } from "@/components/LoginButton";
import { TestnetFundingBar } from "@/components/TestnetFundingBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount, middleTruncate } from "@/lib/format";
import { assetFromSplit, type Split, type SplitParticipant } from "@/lib/split";
import { QRCodeSVG } from "qrcode.react";

const POLL_MS = 4000;

export default function SplitPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = usePollarAuth();
  const [split, setSplit] = useState<Split | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/splits/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setSplit(data.split);
  }, [id]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/splits/${id}`).then(async (res) => {
      if (ignore) return;
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!ignore) setSplit(data.split);
    });
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    if (!split || split.status !== "open") return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [split, refresh]);

  const link = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/split/${id}`;
  }, [id]);

  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="text-xl font-bold">Split not found</h1>
        <p className="text-sm text-muted">This link doesn&apos;t match any split.</p>
        <BackLink />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <PollarLogo size={72} />
        <h1 className="text-2xl font-bold">You&apos;ve been invited to a split</h1>
        <p className="text-sm leading-6 text-muted">
          Log in with Pollar to see the details and pay your share.
        </p>
        <LoginButton />
      </main>
    );
  }

  if (!split) return null;

  const isCollector = user.address === split.collectorAddress;
  const paidCount = split.participants.filter((p) => p.paidAt).length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <BackLink />
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">{split.description}</h1>
            <p className="text-sm text-muted">
              {formatAmount(split.totalAmount)} {split.assetCode} ·{" "}
              {paidCount}/{split.participants.length} paid
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            split.status === "closed"
              ? "bg-success-light text-success"
              : "bg-primary-light text-primary"
          }`}
        >
          {split.status === "closed" ? "Closed" : "Open"}
        </span>
      </div>

      {split.status === "open" && <TestnetFundingBar />}

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6">
        <div className="rounded-xl bg-white p-3">
          <QRCodeSVG value={link} size={180} />
        </div>
        <p className="break-all text-center font-mono text-xs text-muted">{link}</p>
        <p className="text-center text-xs text-muted-light">
          Share this QR or link so everyone can open their share and pay.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {split.participants.map((p) => (
          <ParticipantRow
            key={p.id}
            split={split}
            participant={p}
            userAddress={user.address}
            onPaid={refresh}
          />
        ))}
      </div>

      {isCollector && split.status === "open" && (
        <CloseButton splitId={split.id} collectorAddress={user.address} onClosed={refresh} />
      )}
    </main>
  );
}

function ParticipantRow({
  split,
  participant,
  userAddress,
  onPaid,
}: {
  split: Split;
  participant: SplitParticipant;
  userAddress: string;
  onPaid: () => void;
}) {
  const { runTx } = usePollar();
  const [state, setState] = useState<
    | { step: "idle" }
    | { step: "confirming" }
    | { step: "paying" }
    | { step: "recording"; hash: string }
    // The on-chain payment already succeeded here — only the recording
    // step failed (e.g. a dropped connection). Retrying must re-submit the
    // same hash, never trigger a second real payment.
    | { step: "record-failed"; hash: string; message: string }
    | { step: "pay-failed"; message: string }
  >({ step: "idle" });

  async function record(hash: string) {
    setState({ step: "recording", hash });
    try {
      const res = await fetch(`/api/splits/${split.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          payerAddress: userAddress,
          hash,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Payment sent but could not be recorded.");
      }
      setState({ step: "idle" });
      onPaid();
    } catch (err) {
      setState({
        step: "record-failed",
        hash,
        message:
          err instanceof Error ? err.message : "Payment sent but could not be recorded.",
      });
    }
  }

  async function pay() {
    setState({ step: "paying" });
    try {
      const result = await runTx(
        "payment",
        {
          destination: split.collectorAddress,
          amount: participant.shareAmount,
          asset: assetFromSplit(split),
        },
        { memo: { type: "text", value: split.shortRef } }
      );
      if (result.status === "error") {
        setState({
          step: "pay-failed",
          message:
            result.message ??
            result.details ??
            "The payment didn't go through. Check your balance and try again.",
        });
        return;
      }
      await record(result.hash);
    } catch (err) {
      setState({
        step: "pay-failed",
        message: err instanceof Error ? err.message : "The payment didn't go through.",
      });
    }
  }

  if (participant.paidAt) {
    return (
      <Card className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-foreground">{participant.label}</span>
          <span className="font-mono text-sm text-success">
            ✓ {formatAmount(participant.shareAmount)} {split.assetCode}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            {participant.payerAddress && middleTruncate(participant.payerAddress, 6, 6)}
          </span>
          {participant.txHash && (
            <a
              className="text-primary underline"
              href={`https://testnet.stellar.expert/tx/${participant.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction →
            </a>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{participant.label}</span>
        <span className="font-mono text-sm text-muted">
          {formatAmount(participant.shareAmount)} {split.assetCode}
        </span>
      </div>

      {state.step === "confirming" ? (
        <div className="flex gap-2">
          <Button onClick={() => void pay()} className="flex-1">
            Confirm
          </Button>
          <Button
            variant="secondary"
            onClick={() => setState({ step: "idle" })}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      ) : state.step === "record-failed" ? (
        <Button onClick={() => void record(state.hash)} loading={false} className="w-full">
          Retry confirming payment
        </Button>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setState({ step: "confirming" })}
          loading={state.step === "paying" || state.step === "recording"}
          className="w-full"
        >
          {state.step === "paying"
            ? "Paying…"
            : state.step === "recording"
              ? "Confirming…"
              : "Pay this share"}
        </Button>
      )}

      {state.step === "record-failed" && (
        <p className="text-sm text-error">
          Your payment went through — {state.message} Tap retry, this won&apos;t charge
          you again.
        </p>
      )}
      {state.step === "pay-failed" && <p className="text-sm text-error">{state.message}</p>}
    </Card>
  );
}

function CloseButton({
  splitId,
  collectorAddress,
  onClosed,
}: {
  splitId: string;
  collectorAddress: string;
  onClosed: () => void;
}) {
  const [closing, setClosing] = useState(false);

  async function close() {
    setClosing(true);
    try {
      await fetch(`/api/splits/${splitId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectorAddress }),
      });
      onClosed();
    } finally {
      setClosing(false);
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={() => void close()}
      loading={closing}
      className="self-center"
    >
      Close split
    </Button>
  );
}
