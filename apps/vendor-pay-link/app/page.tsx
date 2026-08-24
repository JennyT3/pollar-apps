"use client";

import { useCallback, useEffect, useState } from "react";
import manifest from "@/pollar.manifest.json";
import { LoginButton } from "@/components/LoginButton";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { WalletBalancesMenu } from "@/components/WalletBalancesMenu";
import { VendorSetup } from "@/components/vendor/VendorSetup";
import {
  ChargeScreen,
  PaymentsHistoryScreen,
  SalesTodayScreen,
} from "@/components/vendor/VendorScreens";
import { usePaymentDetection } from "@/hooks/usePaymentDetection";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import type { Vendor } from "@/lib/types";

type Tab = "charge" | "sales" | "history";

const APP_NAME = manifest.name || "Puesto";

function useIsClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

export default function Home() {
  const { user, isLoading, login, verified } = usePollarAuth();
  const mounted = useIsClient();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("charge");
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpSales = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const activeVendor = user ? vendor : null;

  usePaymentDetection(
    activeVendor?.address ?? null,
    Boolean(activeVendor) && verified,
    bumpSales
  );

  useEffect(() => {
    if (!mounted) return;
    const address = user?.address;
    if (!address) return;
    let cancelled = false;
    async function load() {
      setVendorLoading(true);
      try {
        const res = await fetch(
          `/api/vendor?address=${encodeURIComponent(address as string)}`
        );
        const data = (await res.json()) as { vendor: Vendor | null };
        if (!cancelled) setVendor(data.vendor);
      } finally {
        if (!cancelled) setVendorLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mounted, user?.address]);

  const hero = (
    <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-5 py-12 text-center sm:gap-8 sm:px-6 sm:py-16">
      <div className="flex flex-col items-center gap-4 sm:gap-5">
        <BrandLogo size={80} priority />
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          {APP_NAME}
          <span className="mt-2 block text-primary">Cobra con QR</span>
        </h1>
        <p className="max-w-sm text-base leading-7 text-muted sm:text-lg sm:leading-8">
          Sin tienda. Sin papeles. Entra con Pollar e imprime el QR de tu
          puesto.
        </p>
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-hero" aria-hidden />
        {hero}
        <div className="mx-auto mb-16 h-11 w-44 animate-pulse rounded-xl bg-primary/20" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-hero" aria-hidden />
        {hero}
        <div className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-5 pb-12">
          <LoginButton />
          {isLoading && (
            <p className="text-sm text-muted">Conectando con Pollar…</p>
          )}
          {!isLoading && (
            <button
              type="button"
              onClick={login}
              className="text-sm text-muted underline-offset-2 hover:underline"
            >
              ¿Comprador? Pídele al vendedor que te muestre su QR
            </button>
          )}
        </div>
      </main>
    );
  }

  if (vendorLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted">Cargando tu puesto…</p>
      </main>
    );
  }

  if (!activeVendor) {
    return (
      <VendorSetup
        address={user.address}
        onReady={(v) => setVendor(v)}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:max-w-lg sm:px-5 sm:pt-6 lg:max-w-xl">
      <header className="mb-4 flex items-center justify-between gap-2 sm:mb-5 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <BrandLogo size={32} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs">
              {APP_NAME}
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              {activeVendor.name}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <WalletBalancesMenu />
          <LoginButton />
        </div>
      </header>

      {tab === "charge" ? (
        <ChargeScreen vendor={activeVendor} />
      ) : tab === "sales" ? (
        <SalesTodayScreen
          address={activeVendor.address}
          refreshKey={refreshKey}
        />
      ) : (
        <PaymentsHistoryScreen
          address={activeVendor.address}
          refreshKey={refreshKey}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-2 py-2 sm:max-w-lg lg:max-w-xl">
          <TabButton
            active={tab === "charge"}
            onClick={() => setTab("charge")}
            label="Cobrar"
          />
          <TabButton
            active={tab === "sales"}
            onClick={() => {
              setTab("sales");
              bumpSales();
            }}
            label="Hoy"
          />
          <TabButton
            active={tab === "history"}
            onClick={() => {
              setTab("history");
              bumpSales();
            }}
            label="Historial"
          />
        </div>
      </nav>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted hover:bg-surface hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
