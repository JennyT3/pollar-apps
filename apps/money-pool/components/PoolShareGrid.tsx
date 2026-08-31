import React from 'react';
import { PoolQRCode } from "./PoolQRCode";
import { ShareButton } from "./ShareButton";
import type { PoolWithTotal } from "@/lib/pools";

interface PoolShareGridProps {
  pool: PoolWithTotal;
}

export function PoolShareGrid({ pool }: PoolShareGridProps) {
  const isClosed = pool.status === 'closed';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      {!isClosed && (
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col items-center h-full transition-all hover:shadow-md">
          <h2 className="text-sm font-bold mb-3 text-foreground text-center uppercase tracking-wider">Contribucion</h2>
          <PoolQRCode mode="contribute" poolId={pool.id} />
          <div className="mt-auto pt-4 w-full flex items-center justify-center">
            <p className="text-xs text-muted text-center max-w-48">
              Escanea para contribuir usando Pollar.
            </p>
          </div>
        </div>
      )}

      <div className={`bg-surface border border-border rounded-2xl shadow-sm p-5 flex flex-col items-center h-full transition-all hover:shadow-md ${isClosed ? 'sm:col-span-2' : ''}`}>
        <h2 className="text-sm font-bold mb-3 text-foreground text-center uppercase tracking-wider">Compartir Enlace</h2>
        <PoolQRCode mode="share" poolId={pool.id} />
        <div className="mt-auto pt-4 w-full flex items-center justify-center">
          <div className="w-full max-w-40">
            <ShareButton title={`Pool: ${pool.name}`} path={`/pool/${pool.id}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
