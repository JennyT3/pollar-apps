"use client";

import { useEffect, useState, use } from "react";
import { notFound } from "next/navigation";
import { ProgressBar } from "../../../components/ProgressBar";
import { PoolActions } from "../../../components/PoolActions";
import { PoolShareGrid } from "../../../components/PoolShareGrid";
import { ContributionList } from "../../../components/ContributionList";
import { BottomNav } from "../../../components/BottomNav";
import { PollarLogo } from "../../../components/ui/PollarLogo";
import { LoginButton } from "../../../components/LoginButton";
import { Card } from "../../../components/ui/Card";
import type { PoolWithTotal } from "@/lib/pools";

export default function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pool, setPool] = useState<PoolWithTotal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pools/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) notFound();
          throw new Error("Failed to fetch pool");
        }
        return res.json();
      })
      .then((data) => {
        setPool(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pools/${id}`);
        if (res.ok) {
          const updatedPool = await res.json();
          setPool(updatedPool);
        }
      } catch (err) {
        console.error("Failed to fetch pool updates", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  if (isLoading) {
    return <div className="p-10 text-center">Cargando datos del pool...</div>;
  }

  if (!pool) {
    return <div className="p-10 text-center text-red-500">Error al cargar el pool</div>;
  }

  const isClosed = pool.status === 'closed';

  const mappedContributions = (pool.contributions || []).map((c) => ({
    id: c.id,
    contributorName: c.contributorName,
    contributorAddress: c.contributorAddress,
    amount: c.amount,
    txHash: c.txHash,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 pb-24 lg:max-w-lg lg:py-12 lg:pb-28">
      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
            Pool
          </h1>
        </div>
        <LoginButton />
      </header>

      <Card className="overflow-hidden mb-2">
        <div className="p-6 text-center pb-4">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">{pool.name}</h1>
          {pool.description && (
            <p className="text-muted max-w-2xl mx-auto">{pool.description}</p>
          )}
        </div>

        <div className="px-6 pb-6">
          <ProgressBar
            total={pool.total}
            goal={pool.goalAmount}
            percentage={pool.percentage}
          />
        </div>

        <div className="px-6 pb-6 flex flex-wrap gap-4 text-xs font-medium text-muted/80  border-b border-border">
          <div className="flex items-center gap-1.5" title="Organizador del Pool">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span className="truncate max-w-30">{pool.organizerAddress.substring(0, 4)}...{pool.organizerAddress.substring(52)}</span>
          </div>
          {pool.deadline && (
            <div className="flex items-center gap-1.5" title="Fecha límite">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              <span>{new Date(pool.deadline).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-surface/50">
          {isClosed && (
            <div className="bg-error-light border border-error-border text-error p-4 rounded-xl text-center font-medium w-full shadow-sm mb-4">
              Este pool ha sido cerrado. Ya no se aceptan más contribuciones.
            </div>
          )}

          {!isClosed && (
            <PoolActions pool={pool} onPoolUpdated={setPool} />
          )}
        </div>
      </Card>

      <div className="mb-2">
        <PoolShareGrid pool={pool} />
      </div>

      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
        <ContributionList contributions={mappedContributions} />
      </div>

      <BottomNav />
    </main>
  );
}
