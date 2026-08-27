"use client";

import { useState } from "react";
import { usePollar } from "@pollar/react";
import { Button } from "@/components/ui/Button";
import { useBalance } from "@/hooks/useBalance";
import { contributionAssetFrom } from "@/lib/payments";

export function ContributeButton({
  amount,
  recipient,
  memoId,
  onPaid,
}: {
  amount: string;
  recipient: string;
  memoId: string;
  onPaid: (hash: string) => Promise<void> | void;
}) {
  const { isAuthenticated, verified, runTx } = usePollar();
  const { asset, isLoading } = useBalance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  const usdcReady =
    asset &&
    asset.type !== "native" &&
    asset.code === "USDC" &&
    Boolean(asset.issuer);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const paymentAsset = contributionAssetFrom(asset);
      const result = await runTx(
        "payment",
        {
          destination: recipient,
          amount,
          asset: paymentAsset,
        },
        { memo: { type: "id", value: memoId } }
      );
      if (result.status === "error") {
        setError(result.message ?? result.details ?? "El pago no pasó");
        return;
      }
      setHash(result.hash);
      await onPaid(result.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "El pago no pasó");
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return <p className="text-sm text-muted">Entrá con Pollar para pagar.</p>;
  }

  if (isLoading || !asset) {
    return <p className="text-sm text-muted">Esperando el saldo USDC…</p>;
  }

  if (!usdcReady) {
    return (
      <p className="text-sm text-error">
        Este pago es en USDC, no en XLM. El saldo USDC todavía no está listo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={pay} loading={busy} disabled={!verified}>
        {busy ? "Pagando…" : `Pagar ${amount} USDC`}
      </Button>
      {hash ? (
        <p className="break-all text-xs text-success">Hash: {hash}</p>
      ) : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
