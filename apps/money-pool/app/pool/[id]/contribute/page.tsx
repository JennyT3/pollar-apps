"use client";

import { useEffect, useState, use } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { usePollarAuth } from '../../../../hooks/usePollarAuth';
import { LoginButton } from '../../../../components/LoginButton';
import { ContributeButton } from '../../../../components/ContributeButton';
import { BottomNav } from '../../../../components/BottomNav';
import { STELLAR_EXPERT_URL } from '../../../../lib/stellar';
import Link from 'next/link';

type PoolResponse = {
  id: string;
  name: string;
  description: string | null;
  goalAmount: string;
  total: string;
  status: string;
  organizerAddress: string;
};

export default function ContributePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>,
  searchParams: Promise<{ amount?: string }>
}) {
  const { id } = use(params);
  const { amount: initialAmount } = use(searchParams);
  const router = useRouter();

  const [pool, setPool] = useState<PoolResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [amount, setAmount] = useState(initialAmount || '');
  const { user, isLoading: authLoading } = usePollarAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [successHash, setSuccessHash] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pools/${id}`)
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) notFound();
          throw new Error('Failed to fetch pool');
        }
        return res.json();
      })
      .then(data => {
        setPool(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, [id]);

  const handleSuccess = async (result: { hash: string; status: string }) => {
    setIsRegistering(true);
    setRegisterError(null);
    try {
      const res = await fetch(`/api/pools/${id}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          txHash: result.hash,
          contributorName: null,
          contributorAddress: user?.address || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la contribución');
      }

      setSuccessHash(result.hash);
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Error desconocido al registrar');
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center">Cargando datos del pool...</div>;
  }

  if (!pool) {
    return <div className="p-10 text-center text-red-500">Error al cargar el pool</div>;
  }

  if (successHash) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 lg:max-w-lg lg:py-12">
        <Card className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">¡Contribución registrada!</h1>
          <p className="text-gray-600 mb-6">
            Has contribuido exitosamente con {amount} USDC al pool {pool.name}.
          </p>
          <a
            href={`${STELLAR_EXPERT_URL}/tx/${successHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline mb-8 break-all max-w-full"
          >
            Ver en Stellar Expert
          </a>
          <Button onClick={() => router.push(`/pool/${pool.id}`)} className="w-full py-3">
            Ver el pool
          </Button>
        </Card>
      </main>
    );
  }

  const formattedGoal = parseFloat(pool.goalAmount).toFixed(2);
  const formattedTotal = parseFloat(pool.total || '0').toFixed(2);
  const maxAllowed = parseFloat(pool.goalAmount) - parseFloat(pool.total || '0');

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 pb-24 lg:max-w-lg lg:py-12 lg:pb-28">
      <div className="flex justify-start items-center mb-6">
        <Link href={`/pool/${pool.id}`} className="inline-flex items-center text-sm font-medium text-muted hover:text-primary transition-colors">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Volver atrás
        </Link>
      </div>

      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-2">Contribuir a: {pool.name}</h1>
        {pool.description && (
          <p className="text-gray-600 mb-6">{pool.description}</p>
        )}

        <div className="mb-6">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Objetivo</p>
          <p className="text-lg font-bold">${formattedGoal} USDC</p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Progreso Actual</p>
          <p className="text-lg font-bold">${formattedTotal} de ${formattedGoal} recaudados</p>
        </div>

        {pool.status === 'closed' ? (
          <div className="mt-6 border-t pt-6 text-center">
            <div className="bg-error-light text-error p-4 rounded-xl font-medium mb-4 shadow-sm border border-error-border">
              Este pool ya está cerrado. No se aceptan más contribuciones.
            </div>
            <a
              href={`/pool/${pool.id}`}
              className="text-primary hover:text-primary-hover font-semibold transition-colors inline-flex items-center"
            >
              Ver resultado del pool &rarr;
            </a>
          </div>
        ) : (
          <div className="mt-6 border-t pt-6">
            {!authLoading && !user ? (
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-600 mb-4 text-center">Inicia sesión para poder realizar una contribución.</p>
                <LoginButton />
              </div>
            ) : (
              <>
                <label htmlFor="amount" className="block text-sm font-medium mb-2">
                  Monto a contribuir (USDC)
                </label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.includes('.')) {
                      const parts = val.split('.');
                      if (parts[1].length > 2) {
                        val = `${parts[0]}.${parts[1].slice(0, 2)}`;
                      }
                    }
                    setAmount(val);
                  }}
                  placeholder="10.00"
                  className="mb-4"
                  disabled={isRegistering}
                />

                {registerError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 mb-4">
                    {registerError}
                  </p>
                )}

                <div className="relative group">
                  <ContributeButton
                    poolId={pool.id}
                    organizerAddress={pool.organizerAddress}
                    amount={amount}
                    maxAllowed={maxAllowed}
                    onSuccess={handleSuccess}
                    disabled={isRegistering}
                  />
                  {isRegistering && (
                    <p className="text-xs text-blue-600 mt-2 text-center animate-pulse">
                      Registrando contribución...
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Card>
      {user && <BottomNav />}
    </main>
  );
}
