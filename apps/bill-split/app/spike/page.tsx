"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { LoginButton } from "@/components/LoginButton";
import { PayButton, type PaymentResult } from "@/components/PayButton";
import { TestnetFundingBar } from "@/components/TestnetFundingBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { useIsClient } from "@/hooks/useIsClient";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { middleTruncate } from "@/lib/format";
import { looksLikeAddress } from "@/lib/payments";
import { QRCodeSVG } from "qrcode.react";

function buildSpikeLink(address: string, amount: string, reference: string): string {
  const url = new URL("/spike", window.location.origin);
  url.searchParams.set("to", address);
  url.searchParams.set("amount", amount);
  if (reference) url.searchParams.set("ref", reference);
  return url.toString();
}

/**
 * Spike page for issue #6's blocking criterion: prove the QR-prefilled
 * payment loop works end to end between two Pollar accounts on testnet,
 * and capture the resulting hash. Not part of the final app UI.
 *
 * No `to`/`amount` in the URL → collector view (generate a QR).
 * `to` + `amount` present → participant view (pay it, reusing PayButton).
 */
export default function SpikePage() {
  return (
    <Suspense fallback={null}>
      <SpikeContent />
    </Suspense>
  );
}

function SpikeContent() {
  const { user } = usePollarAuth();
  const searchParams = useSearchParams();
  const to = searchParams.get("to");
  const amount = searchParams.get("amount");
  const reference = searchParams.get("ref");

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <PollarLogo size={72} />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Bill Split — payment spike</h1>
          <p className="text-sm leading-6 text-muted">
            Log in to test the QR payment loop between two Pollar accounts.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  if (to && amount && looksLikeAddress(to)) {
    return <ParticipantView to={to} amount={amount} reference={reference} />;
  }

  return <CollectorView address={user.address} />;
}

function CollectorView({ address }: { address: string }) {
  const [amount, setAmount] = useState("1.00");
  const [reference, setReference] = useState("spike-test");

  // `useIsClient` keeps the server render and React's first client pass in
  // agreement (both "not yet"), so this never mismatches during hydration
  // the way computing it unconditionally would.
  const isClient = useIsClient();
  const link = isClient ? buildSpikeLink(address, amount, reference) : "";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-2">
        <BackLink />
        <h1 className="text-xl font-bold">Spike: generate a QR to get paid</h1>
      </div>
      <p className="-mt-3 text-sm leading-6 text-muted">
        Collector view. Set a test amount, then open the link below from a{" "}
        <strong>second</strong> Pollar account (another browser/profile, or
        scan the QR from a phone on the same network) to pay it.
      </p>

      <TestnetFundingBar />

      <Card className="flex flex-col gap-4 p-4">
        <Input
          label="Amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
        />
        <Input
          label="Reference (memo)"
          value={reference}
          maxLength={28}
          onChange={(e) => setReference(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            Your address (collector)
          </span>
          <p className="break-all font-mono text-xs text-muted">{address}</p>
        </div>
      </Card>

      {link && amount && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={link} size={200} />
          </div>
          <p className="break-all text-center font-mono text-xs text-muted">
            {link}
          </p>
        </div>
      )}
    </main>
  );
}

function ParticipantView({
  to,
  amount,
  reference,
}: {
  to: string;
  amount: string;
  reference: string | null;
}) {
  const [result, setResult] = useState<PaymentResult | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Spike: pay via QR</h1>
        <p className="text-sm leading-6 text-muted">
          Participant view. These details came from the scanned QR — confirm
          to send the payment.
        </p>
      </div>

      <TestnetFundingBar />

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        <Row label="To" value={middleTruncate(to, 6, 6)} title={to} />
        <Row label="Amount" value={amount} />
        {reference && <Row label="Reference" value={reference} />}
      </div>

      <PayButton
        amount={amount}
        recipient={to}
        label="Pay via QR"
        onSuccess={(res) => setResult(res)}
      />

      {result && (
        <div className="flex flex-col gap-2 rounded-xl border border-success-border bg-success-light p-4 text-sm">
          <p className="font-medium text-success">Paid — hash captured:</p>
          <p className="break-all font-mono text-xs">{result.hash}</p>
          <a
            className="text-primary underline"
            href={`https://testnet.stellar.expert/tx/${result.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Stellar Expert (testnet) →
          </a>
        </div>
      )}

      <Button
        variant="ghost"
        onClick={() => window.history.back()}
        className="self-start"
      >
        ← Back
      </Button>
    </main>
  );
}

function Row({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm font-medium" title={title}>
        {value}
      </span>
    </div>
  );
}
