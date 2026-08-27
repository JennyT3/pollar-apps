"use client";

import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { BalanceCard } from "@/components/BalanceCard";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { BottomNav } from "@/components/BottomNav";

export default function Home() {
  const { user } = usePollarAuth();

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Money Pool
            <span className="block text-primary">Colecta grupal</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Crea una colecta, comparte el código QR y recibe aportes directos en tu cuenta de Pollar. Sin custodia.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 pb-24 lg:max-w-lg lg:py-12 lg:pb-28">
      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
            Money Pool
          </h1>
        </div>
        <LoginButton />
      </header>

      <BalanceCard />

      <div className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Crear un pool</h2>
          <p className="text-muted text-sm leading-relaxed max-w-[250px] mx-auto">
            Inicia una nueva colecta grupal para tu próximo evento, regalo o meta.
          </p>
        </div>
        <Link
          href="/pool/new"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.97]"
        >
          Comenzar
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
