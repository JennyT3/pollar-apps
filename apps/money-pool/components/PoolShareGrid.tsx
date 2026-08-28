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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 md:bg-surface md:border md:border-border md:rounded-2xl md:shadow-sm overflow-hidden w-full">
      {!isClosed && (
        <div className="bg-surface border border-border rounded-2xl shadow-sm md:bg-transparent md:border-0 md:shadow-none md:rounded-none p-4 md:pr-0 flex flex-col items-center">
          <h2 className="text-lg font-bold mb-2 text-foreground text-center">QR de Contribución</h2>
          <PoolQRCode mode="contribute" poolId={pool.id} />
          <p className="text-xs text-muted mt-2 text-center max-w-48">
            Escanea para contribuir usando Pollar.
          </p>
        </div>
      )}

      <div className={`bg-surface border border-border rounded-2xl shadow-sm md:bg-transparent md:border-0 md:shadow-none md:rounded-none p-4 md:pl-0 flex flex-col items-center ${isClosed ? 'md:col-span-2 md:px-4!' : ''}`}>
        <h2 className="text-lg font-bold mb-2 text-foreground text-center">Compartir</h2>
        <PoolQRCode mode="share" poolId={pool.id} />
        <div className="mt-4 w-full max-w-40">
          <ShareButton title={`Pool: ${pool.name}`} path={`/pool/${pool.id}`} />
        </div>
      </div>
    </div>
  );
}
