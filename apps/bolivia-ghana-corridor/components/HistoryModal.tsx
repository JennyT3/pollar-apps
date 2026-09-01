"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  CORRIDOR_TERMINAL_STATUSES,
  loadHistory,
  upsertHistory,
  type CorridorHistoryRecord,
} from "@/lib/history";

const STATUS_LABEL: Record<CorridorHistoryRecord["status"], string> = {
  QUOTED: "Quoted",
  AWAITING_CRYPTO: "Awaiting USDC",
  CRYPTO_CONFIRMED: "Crypto confirmed",
  PAYOUT_PENDING: "Payout pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  EXPIRED: "Expired",
};

const STATUS_TONE: Record<CorridorHistoryRecord["status"], string> = {
  QUOTED: "bg-surface text-muted",
  AWAITING_CRYPTO: "bg-primary-light text-primary",
  CRYPTO_CONFIRMED: "bg-primary-light text-primary",
  PAYOUT_PENDING: "bg-primary-light text-primary",
  COMPLETED: "bg-success-light text-success",
  FAILED: "bg-error-light text-error",
  EXPIRED: "bg-surface text-muted",
};

export function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  // Bumped after every successful refresh purely to trigger a re-render --
  // localStorage is the real source of truth here (read fresh below), not
  // React state, so there's nothing to keep in sync via an effect or a ref.
  const [, forceUpdate] = useState(0);

  const records = open ? loadHistory() : [];

  async function refresh(record: CorridorHistoryRecord) {
    setRefreshingId(record.id);
    try {
      const res = await fetch(`/api/morapay/bridge/status/${record.id}`);
      const body = await res.json();
      if (body?.success) {
        const data = body.data;
        upsertHistory({
          ...record,
          status: data.status,
          stellarTxHash: data.stellarTxHash ?? record.stellarTxHash,
          momoReference: data.momoReference ?? record.momoReference,
          failureCode: data.failureCode ?? record.failureCode,
          failureMessage: data.failureMessage ?? record.failureMessage,
        });
        forceUpdate((v) => v + 1);
      }
    } catch {
      // Best-effort refresh — leave the last known state as-is on failure.
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Recent transfers">
      {records.length === 0 ? (
        <EmptyState
          title="No transfers yet"
          description="Bolivia -> Ghana transfers from the last 24 hours show up here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((r) => {
            const isTerminal = CORRIDOR_TERMINAL_STATUSES.includes(r.status);
            return (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {r.sourceAmount} {r.sourceCurrency} &rarr; {r.destAmount} {r.destCurrency}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <span className="text-xs text-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
                {r.momoReference && (
                  <span className="text-xs text-muted">MoMo ref: {r.momoReference}</span>
                )}
                {r.failureMessage && (
                  <span className="text-xs text-error">{r.failureMessage}</span>
                )}
                {!isTerminal && (
                  <Button
                    variant="secondary"
                    onClick={() => void refresh(r)}
                    loading={refreshingId === r.id}
                    className="self-start px-3 py-1.5 text-xs"
                  >
                    {refreshingId === r.id ? <Spinner size={12} /> : null}
                    Refresh status
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
