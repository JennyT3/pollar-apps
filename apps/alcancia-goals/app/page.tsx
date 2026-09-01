"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import manifest from "@/pollar.manifest.json";
import { BalanceCard } from "@/components/BalanceCard";
import { CoverageBanner } from "@/components/CoverageBanner";
import { GoalCard } from "@/components/GoalCard";
import { LoginButton } from "@/components/LoginButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { Spinner } from "@/components/ui/Spinner";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { listGoals, type GoalWithProgress } from "@/lib/api";

const APP_NAME = manifest.name || "Alcancía";

export default function Home() {
  const { user } = usePollarAuth();
  const [goals, setGoals] = useState<GoalWithProgress[] | null>(null);

  useEffect(() => {
    if (!user) return;
    void listGoals(user.address).then((r) => setGoals(r.goals));
  }, [user]);

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {APP_NAME}
            <span className="block text-primary">tu meta, creciendo</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Poné una meta, apartá plata o juntala en familia por QR, y mirá cómo se llena.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  const active = goals?.filter((g) => g.status === "active") ?? [];
  const done = goals?.filter((g) => g.status !== "active") ?? [];

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
      <CoverageBanner />

      <Link
        href="/goals/new"
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.97]"
      >
        + Nueva meta
      </Link>

      {goals === null ? (
        <div className="flex justify-center py-10">
          <Spinner size={24} />
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          title="Todavía no tenés metas"
          description="Creá tu primera alcancía: la bici, el viaje, el fondo de diciembre."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {active.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Activas
              </h2>
              <div className="flex flex-col gap-2">
                {active.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Completadas y archivadas
              </h2>
              <div className="flex flex-col gap-2">
                {done.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
