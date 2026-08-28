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

      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground tracking-tight">{pool.name}</h1>
        {pool.description && (
          <p className="text-lg text-muted max-w-2xl mx-auto mt-2">{pool.description}</p>
        )}
      </div>

      <ProgressBar
        total={pool.total}
        goal={pool.goalAmount}
        percentage={pool.percentage}
      />

      {isClosed && (
        <div className="bg-error-light border border-error-border text-error p-4 rounded-xl text-center font-medium w-full shadow-sm">
          Este pool ha sido cerrado. Ya no se aceptan más contribuciones.
        </div>
      )}

      {!isClosed && <PoolActions pool={pool} onPoolUpdated={setPool} />}

      <PoolShareGrid pool={pool} />

      <ContributionList contributions={mappedContributions} />

      <BottomNav />
    </main>
  );
}
