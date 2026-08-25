"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import manifest from "@/pollar.manifest.json";
import { BalanceCard } from "@/components/BalanceCard";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount } from "@/lib/format";
import type { Split } from "@/lib/split";

const APP_NAME = manifest.name || "My Pollar App";

export default function Home() {
  const { user } = usePollarAuth();
  const [splits, setSplits] = useState<Split[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    fetch(`/api/splits?collector=${user.address}`)
      .then(async (res) => (res.ok ? (await res.json()).splits : []))
      .catch(() => [])
      .then((splits) => {
        if (!ignore) setSplits(splits);
      });
    return () => {
      ignore = true;
    };
  }, [user]);

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {APP_NAME}
            <span className="block text-primary">split it, pay by QR</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Split a bill with friends and settle each share on Pollar. No
            crypto knowledge needed.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 lg:max-w-lg lg:py-10">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
            {APP_NAME}
          </h1>
        </div>
        <LoginButton />
      </header>

      <BalanceCard />

      <Link href="/split/new">
        <Button className="w-full py-3">+ New split</Button>
      </Link>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-muted">Your splits</span>
        {splits === null ? (
          <div className="h-20 animate-pulse rounded-2xl bg-surface" />
        ) : splits.length === 0 ? (
          <EmptyState
            title="No splits yet"
            description="Create one to start collecting shares from friends by QR."
          />
        ) : (
          splits.map((split) => (
            <Link key={split.id} href={`/split/${split.id}`}>
              <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary/40">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium text-foreground">
                    {split.description}
                  </span>
                  <span className="text-xs text-muted">
                    {split.participants.filter((p) => p.paidAt).length}/
                    {split.participants.length} paid
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {formatAmount(split.totalAmount)} {split.assetCode}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      split.status === "closed"
                        ? "bg-success-light text-success"
                        : "bg-primary-light text-primary"
                    }`}
                  >
                    {split.status === "closed" ? "Closed" : "Open"}
                  </span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      <Link
        href="/spike"
        className="mt-auto pt-4 text-center text-xs text-muted-light underline"
      >
        Payment spike (dev/testing)
      </Link>
    </main>
  );
}
