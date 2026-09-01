"use client";

import { useState } from "react";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can be denied — the value is still visible to copy manually.
        }
      }}
      className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-muted hover:bg-border"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Renders whatever a ramp/bridge provider hands back for "pay this to
 * continue" — a QR image, an opaque payload/code, or a flat set of fields
 * (account number, reference, etc.). Providers shape this differently, so
 * this stays defensive rather than assuming one exact structure.
 */
export function ScannablePayment({ data }: { data: Record<string, unknown> }) {
  const rows: { key: string; label: string; node: React.ReactNode }[] = [];

  const scannable = data.scannable as
    | {
        payload?: string | null;
        payloadLabel?: string | null;
        image?: { mediaType?: string; data?: string };
      }
    | undefined;

  if (scannable?.image?.data) {
    const mime = scannable.image.mediaType ?? "image/png";
    rows.push({
      key: "scannable-image",
      label: scannable.payloadLabel || "Scan to pay",
      node: (
        <img
          src={`data:${mime};base64,${scannable.image.data}`}
          alt="Payment QR"
          className="mx-auto block w-full max-w-[220px] rounded-xl border border-border"
        />
      ),
    });
  } else if (scannable?.payload) {
    rows.push({
      key: "scannable-payload",
      label: scannable.payloadLabel || "Payment code",
      node: (
        <span className="flex items-center gap-2">
          <code className="flex-1 break-all text-xs">{scannable.payload}</code>
          <CopyButton value={scannable.payload} />
        </span>
      ),
    });
  }

  const fields = data.fields as
    | { key: string; label?: string; value: string | number; copyable?: boolean }[]
    | undefined;
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (typeof f.value !== "string" && typeof f.value !== "number") continue;
      rows.push({
        key: f.key,
        label: f.label ?? f.key,
        node: f.copyable ? (
          <span className="flex items-center gap-2">
            <code className="flex-1 break-all text-xs">{String(f.value)}</code>
            <CopyButton value={String(f.value)} />
          </span>
        ) : (
          <span className="text-sm">{String(f.value)}</span>
        ),
      });
    }
  }

  // Legacy flat shape some providers use directly on the top-level object.
  if (typeof data.qrBase64 === "string" && data.qrBase64) {
    const v = data.qrBase64;
    rows.push({
      key: "qrBase64",
      label: "Payment QR",
      node: (
        <img
          src={v.startsWith("data:") ? v : `data:image/png;base64,${v}`}
          alt="Payment QR"
          className="mx-auto block w-full max-w-[220px] rounded-xl border border-border"
        />
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.key} className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-light">
            {r.label}
          </div>
          {r.node}
        </div>
      ))}
    </div>
  );
}
