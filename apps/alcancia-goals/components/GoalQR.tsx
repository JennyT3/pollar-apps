"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";

/**
 * A QR that encodes a deep link into this app (contribution or invite),
 * scannable with any phone camera — the same muscle memory as paying at the
 * tienda or the mercado. No in-app scanner needed: opening the link is the
 * whole interaction.
 */
export function GoalQR({ url, caption }: { url: string; caption: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ url, text: caption });
        return;
      } catch {
        // user cancelled the native share sheet — fall through to copy
      }
    }
    await copyLink();
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="rounded-xl bg-background p-3 shadow-sm">
        <QRCodeSVG value={url} size={176} level="M" />
      </div>
      <p className="text-center text-sm text-muted">{caption}</p>
      <div className="flex w-full gap-2">
        <Button variant="secondary" onClick={() => void copyLink()} className="flex-1">
          {copied ? "Copiado ✓" : "Copiar link"}
        </Button>
        <Button onClick={() => void share()} className="flex-1">
          Compartir
        </Button>
      </div>
    </div>
  );
}
