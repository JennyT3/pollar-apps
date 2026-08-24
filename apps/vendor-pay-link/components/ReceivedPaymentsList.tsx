"use client";

import type { Sale } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export function ReceivedPaymentsList({
  sales,
  emptyText,
}: {
  sales: Sale[];
  emptyText: string;
}) {
  if (sales.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {sales.map((sale) => (
        <li key={sale.id} className="flex flex-col gap-1 bg-background px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold tabular-nums">
              {formatMoney(sale.amount)}{" "}
              <span className="text-sm font-medium text-muted">USD</span>
            </span>
            <span className="text-xs text-muted">
              {sale.paidAt
                ? new Date(sale.paidAt).toLocaleString("es-CL", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </span>
          </div>
          {sale.note && <p className="text-sm text-muted">{sale.note}</p>}
          <p className="text-xs text-muted-light">
            {sale.kind === "charge" ? "Cobro con monto" : "QR del puesto"}
          </p>
          {sale.txHash && (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${sale.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver comprobante
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
