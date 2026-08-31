"use client";

import { useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";

/**
 * The QR that gets the group in.
 *
 * It encodes a link into this app, not a raw `G…` address and not a SEP-7 URI.
 * Scanning it opens the join screen with the polla, the organizer's account and
 * the entry amount already filled in, one confirmation away from paying. Typing
 * an address by hand is never part of the flow, which is the point: in Bolivia
 * the QR *is* the way you pay.
 *
 * The URL is built in the browser from `window.location.origin`, so it is
 * always the host the organizer is actually on, with no assumption about
 * forwarded headers on a deploy. It is read as an external store because there
 * is no origin during the server render: the server snapshot is null, the
 * client's is the real host, and React reconciles the two without a flash of
 * wrong markup.
 */

/** The origin never changes within a page's life, so there is nothing to watch. */
const noSubscribe = () => () => {};

export function InviteQr({ code, name }: { code: string; name: string }) {
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => null
  );
  const url = origin ? `${origin}/p/${code}/unirse` : null;
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (an insecure origin, a locked-down browser): the
      // link is on screen anyway, so this is a convenience, not the feature.
    }
  }

  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl border border-border p-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-lg font-bold tracking-tight">Invitá al grupo</h2>
        <p className="text-sm text-muted">
          Que escaneen y entran a {name} pagando con una confirmación.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4">
        {url ? (
          <QRCodeSVG value={url} size={196} level="M" marginSize={0} />
        ) : (
          <div className="h-[196px] w-[196px] animate-pulse rounded-xl bg-surface" />
        )}
      </div>

      <p className="w-full break-all rounded-xl border border-border bg-surface px-4 py-3 text-center font-mono text-xs leading-5">
        {url ?? " "}
      </p>

      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button onClick={() => void copy()} className="flex-1 py-3">
          {copied ? "Link copiado" : "Copiar link"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => window.print()}
          className="flex-1 py-3"
        >
          Imprimir
        </Button>
      </div>

      <p className="text-center text-xs text-muted">
        Código de la polla: <span className="font-mono font-semibold">{code}</span>
      </p>
    </section>
  );
}
