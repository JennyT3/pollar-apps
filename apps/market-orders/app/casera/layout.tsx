"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { CaseraProvider, useCasera } from "./casera-context";
import { LoginButton } from "@/components/LoginButton";
import { PollarLogo } from "@/components/ui/PollarLogo";

/** The four jobs the casera does through the day, one screen each. */
const TABS = [
  { href: "/casera/menu", label: "Menú" },
  { href: "/casera/board", label: "Tablero" },
  { href: "/casera/pickup", label: "Pickup" },
  { href: "/casera/settings", label: "Puesto" },
];

function CaseraShell({ children }: { children: ReactNode }) {
  const { user } = usePollarAuth();
  const { stall, loading, hasToken } = useCasera();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || user) return;
    // Not logged in: the landing page handles login.
    router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;
    if (!stall) router.replace("/");
  }, [loading, user, stall, router]);

  if (!user || loading || !stall) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 lg:max-w-lg lg:py-8">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="min-w-0 truncate text-xl font-bold tracking-tight">
            {stall.name}
          </h1>
        </div>
        <LoginButton />
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors ${
              pathname === tab.href
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {!hasToken && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-warning-border bg-warning-light px-4 py-3 text-sm text-warning">
          <span>Tu clave de administración no está en este dispositivo.</span>
          <Link
            href="/casera/settings"
            className="shrink-0 font-semibold underline"
          >
            Vincular
          </Link>
        </div>
      )}

      {children}
    </main>
  );
}

export default function CaseraLayout({ children }: { children: ReactNode }) {
  return (
    <CaseraProvider>
      <CaseraShell>{children}</CaseraShell>
    </CaseraProvider>
  );
}