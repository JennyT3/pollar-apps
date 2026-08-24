"use client";

import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { PollarLogo } from "@/components/ui/PollarLogo";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 lg:max-w-lg lg:py-10">
      <header className="flex items-center justify-between gap-3 py-2">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
            Pasanaku
          </h1>
        </Link>
        <LoginButton />
      </header>
      {children}
    </main>
  );
}
