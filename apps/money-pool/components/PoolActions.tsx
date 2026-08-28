"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { usePollar } from "@pollar/react";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { buildSessionMessage, POOL_AUTH_HEADER } from "@/lib/server-auth";
import type { PoolWithTotal } from "@/lib/pools";

interface PoolActionsProps {
  pool: PoolWithTotal;
  onPoolUpdated: (pool: PoolWithTotal) => void;
}

export function PoolActions({ pool, onPoolUpdated }: PoolActionsProps) {
  const router = useRouter();
  const { user } = usePollarAuth();
  const { getClient } = usePollar();
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const isOrganizer = user?.address === pool.organizerAddress;
  const isClosed = pool.status === 'closed';

  if (isClosed) return null;

  async function handleConfirmClose() {
    if (!user) return;
    setIsClosing(true);
    try {
      const client = getClient();
      let serverTime = Date.now();
      try {
        const timeRes = await fetch('/api/time');
        if (timeRes.ok) {
          const { time } = await timeRes.json();
          serverTime = time;
        }
      } catch (e) {
        console.warn('Could not fetch server time', e);
      }
      
      const offset = serverTime - Date.now();
      const exp = Date.now() + offset + 10 * 60 * 1000;
      const message = buildSessionMessage(user.address, exp);

      const proof = await client.stellar.sep53.signMessage(message);
      if (proof.status !== 'signed') {
        throw new Error(proof.details || 'Firma cancelada o fallida');
      }

      const res = await fetch(`/api/pools/${pool.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          [POOL_AUTH_HEADER]: JSON.stringify({
            address: user.address,
            exp,
            signature: proof.signature
          })
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const updatedPool = await res.json();
        onPoolUpdated(updatedPool);
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
    <>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <Button
          onClick={() => router.push(`/pool/${pool.id}/contribute`)}
          className="font-semibold py-3.5 px-8 rounded-full shadow-lg transition-transform hover:scale-105 text-lg"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Contribuir a este Pool
        </Button>
        {isOrganizer && (
          <Button
            variant="secondary"
            onClick={() => setIsCloseModalOpen(true)}
            className="text-error! border-error! hover:bg-error/10! py-3.5 px-6 rounded-full h-full"
          >
            Cerrar pool
          </Button>
        )}
      </div>

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
    </>
  );
}
