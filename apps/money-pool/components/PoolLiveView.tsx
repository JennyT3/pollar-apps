"use client";


import { useEffect, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { ContributionList } from "./ContributionList";
import { PoolQRCode } from "./PoolQRCode";
import { ShareButton } from "./ShareButton";
import { BottomNav } from "./BottomNav";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import type { PoolWithTotal } from "@/lib/pools";

interface PoolLiveViewProps {
  initialPool: PoolWithTotal;
}

export function PoolLiveView({ initialPool }: PoolLiveViewProps) {
  const [pool, setPool] = useState<PoolWithTotal>(initialPool);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pools/${initialPool.id}`, {
          headers: { 'x-app-request': 'true' }
        });
        if (res.ok) {
          const updatedPool = await res.json();
          setPool(updatedPool);
        }
      } catch (err) {
        console.error("Failed to fetch pool updates", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [initialPool.id]);

  const mappedContributions = (pool.contributions || []).map((c) => ({
    id: c.id,
    contributorName: c.contributorName,
    contributorAddress: c.contributorAddress,
    amount: c.amount,
    txHash: c.txHash,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  }));

  const { user } = usePollarAuth();
  const isOrganizer = user?.address === pool.organizerUserId;
  const isClosed = pool.status === 'closed';

  function handleCloseClick() {
    setIsCloseModalOpen(true);
  }

  async function handleConfirmClose() {
    setIsClosing(true);
    try {
      const res = await fetch(`/api/pools/${pool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-app-request': 'true' },
        body: JSON.stringify({ organizerUserId: user?.address })
      });
      if (res.ok) {
        const updatedPool = await res.json();
        setPool(updatedPool);
        setIsCloseModalOpen(false);
      } else {
        alert("Error al cerrar el pool");
      }
    } catch (error) {
      console.error(error);
      alert("Error al cerrar el pool");
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 p-4 pb-24">

      <div className="text-center">
        <h1 className="text-4xl font-bold mb-3 text-foreground tracking-tight">{pool.name}</h1>
        {pool.description && (
          <p className="text-lg text-muted max-w-2xl mx-auto">{pool.description}</p>
        )}
      </div>

      <ProgressBar
        total={pool.total}
        goal={pool.goalAmount}
        percentage={pool.percentage}
      />

      {!isClosed && (
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 mb-12">
          <a
            href={`/pool/${pool.id}/contribute`}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold py-3.5 px-8 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 text-lg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Contribuir a este Pool
          </a>
          {isOrganizer && (
            <button
              onClick={handleCloseClick}
              className="text-error hover:text-error-light border border-error hover:bg-error/10 py-3.5 px-6 rounded-full font-medium transition-colors h-full"
            >
              Cerrar pool
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {!isClosed && (
          <div className="bg-surface border border-border p-6 rounded-2xl flex flex-col items-center shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-foreground text-center">QR de Contribución</h2>
            <PoolQRCode mode="contribute" poolId={pool.id} size={200} />
            <p className="text-sm text-muted mt-4 text-center max-w-62.5">
              Escanea para contribuir usando Pollar.
            </p>
          </div>
        )}

        <div className={`bg-surface border border-border p-6 rounded-2xl flex flex-col items-center shadow-sm ${isClosed ? 'md:col-span-2' : ''}`}>
          <h2 className="text-xl font-bold mb-4 text-foreground text-center">Compartir</h2>
          <PoolQRCode mode="share" poolId={pool.id} size={200} />
          <div className="mt-6 w-full max-w-50">
            <ShareButton title={`Pool: ${pool.name}`} path={`/pool/${pool.id}`} />
          </div>
        </div>
      </div>

      <ContributionList contributions={mappedContributions} />

      <Modal
        open={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Cerrar Pool"
      >
        <div className="flex flex-col gap-4">
          <p className="text-center text-muted text-sm mt-2">
            ¿Seguro que deseas cerrar este pool?
            <br />
            Esta acción no se puede deshacer y no se aceptarán más contribuciones.
          </p>
          <div className="flex gap-3 mt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setIsCloseModalOpen(false)}
              disabled={isClosing}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-error hover:bg-error-light text-white"
              onClick={handleConfirmClose}
              loading={isClosing}
            >
              Cerrar pool
            </Button>
          </div>
        </div>
      </Modal>

      {user && <BottomNav />}
    </div>
  );
}
