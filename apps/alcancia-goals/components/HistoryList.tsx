import { EmptyState } from "@/components/ui/EmptyState";
import { formatAmount, shortAddress } from "@/lib/format";
import { explorerTxUrl } from "@/lib/horizon";
import type { HistoryEntry } from "@/lib/goals";

function formatWhen(iso: string): string {
  return new Date(iso + "Z").toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryList({
  entries,
  currency,
  youAddress,
}: {
  entries: HistoryEntry[];
  currency: string;
  youAddress?: string;
}) {
  if (entries.length === 0) {
    return <EmptyState title="Sin movimientos todavía" description="Acá vas a ver cada aporte." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-background">
      {entries.map((entry) => {
        const negative = Number(entry.amount) < 0;
        const you = entry.address === youAddress;
        return (
          <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {you ? "Vos" : shortAddress(entry.address)}
                <span className="ml-2 text-xs font-normal text-muted-light">
                  {entry.kind === "set_aside"
                    ? negative
                      ? "retiró"
                      : "apartó"
                    : "contribuyó"}
                </span>
              </p>
              <p className="text-xs text-muted-light">{formatWhen(entry.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span
                className={`font-mono text-sm font-semibold ${negative ? "text-error" : "text-foreground"}`}
              >
                {negative ? "" : "+"}
                {formatAmount(entry.amount)} {currency}
              </span>
              {entry.txHash && (
                <a
                  href={explorerTxUrl(entry.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {entry.verified ? "verificado ↗" : "ver hash ↗"}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
