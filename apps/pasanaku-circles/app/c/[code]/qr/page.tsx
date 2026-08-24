"use client";

import { use } from "react";
import { AppShell } from "@/components/AppShell";

export default function QrPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <AppShell>
      <h2 className="text-2xl font-bold">QRs del círculo</h2>
      <section className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium">Pagar esta ronda</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QR para pagar" src={`/api/circles/${code}/qr?kind=pay`} className="w-56" />
      </section>
      <section className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium">Unirse</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QR para unirse" src={`/api/circles/${code}/qr?kind=join`} className="w-56" />
      </section>
    </AppShell>
  );
}
