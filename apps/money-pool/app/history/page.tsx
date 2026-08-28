"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginButton } from "@/components/LoginButton";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import type { PoolWithTotal } from "@/lib/pools";
import { BottomNav } from "@/components/BottomNav";

function PoolCard({ pool, isClosed }: { pool: PoolWithTotal; isClosed: boolean }) {
  const formattedTotal = parseFloat(pool.total || "0").toFixed(2);
  const formattedGoal = parseFloat(pool.goalAmount).toFixed(2);

  return (
    <Link
      href={`/pool/${pool.id}`}
      className={`block p-4 border border-border rounded-xl transition-all hover:border-primary/50 hover:shadow-sm ${isClosed ? 'bg-gray-100/50 opacity-80' : 'bg-surface'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-foreground line-clamp-1">{pool.name}</h3>
        {isClosed && (
          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium shrink-0">Cerrado</span>
        )}
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-sm font-semibold text-primary">${formattedTotal}</p>
          <p className="text-xs text-muted">de ${formattedGoal} USDC</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">{pool.percentage}%</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${pool.percentage >= 100 ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, pool.percentage)}%` }}
        />
      </div>
    </Link>
  );
}

export default function HistoryPage() {
  const { user, isLoading: authLoading } = usePollarAuth();
  const [organized, setOrganized] = useState<PoolWithTotal[]>([]);
  const [contributed, setContributed] = useState<PoolWithTotal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.address) {
      if (!authLoading) setTimeout(() => setLoading(false), 0);
      return;
    }

    setTimeout(() => setLoading(true), 0);
    fetch(`/api/user/pools?address=${user.address}`)
      .then(res => res.json())
      .then(data => {
        if (data.organized) setOrganized(data.organized);
        if (data.contributed) setContributed(data.contributed);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [user?.address, authLoading]);

  if (!user && !authLoading) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Historial
            <span className="block text-primary">Inicia sesión</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Inicia sesión con Pollar para ver los pools que has organizado o a los que has aportado.
          </p>
        </div>
        <LoginButton />
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 pb-24 lg:max-w-lg lg:py-12 lg:pb-28">
      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
            Tu Historial
          </h1>
        </div>
        <LoginButton />
      </header>

      {loading ? (
        <div className="flex justify-center items-center py-12 flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Mis Pools</h3>
            {organized.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-border rounded-xl text-muted text-sm">
                Aún no has creado ningún pool.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {organized.map(pool => (
                  <PoolCard key={`org-${pool.id}`} pool={pool} isClosed={pool.status === 'closed'} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Mis Contribuciones</h3>
            {contributed.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-border rounded-xl text-muted text-sm">
                Aún no has aportado a ningún pool.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {contributed.map(pool => (
                  <PoolCard key={`cont-${pool.id}`} pool={pool} isClosed={pool.status === 'closed'} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {user && <BottomNav />}
    </main>
  );
}
