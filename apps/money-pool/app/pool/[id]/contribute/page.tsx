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
import { PollarLogo } from '@/components/ui/PollarLogo';
import { useBalance } from '../../../../hooks/useBalance';
import { ProgressBar } from '../../../../components/ProgressBar';

type PoolResponse = {
  id: string;
  name: string;
  description: string | null;
  goalAmount: string;
  total: string;
  status: string;
  organizerAddress: string;
  deadline: string | null;
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
  const { balance, isLoading: balanceLoading, currency } = useBalance();

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

  const maxAllowed = parseFloat(pool.goalAmount) - parseFloat(pool.total || '0');

  const percentage = (Number(pool.total) / Number(pool.goalAmount)) * 100;

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

      <Card className="overflow-hidden">
        <div className="p-6 pb-4 text-center">
          <h1 className="text-2xl font-bold mb-2 tracking-tight text-foreground">{pool.name}</h1>
          {pool.description && (
            <p className="text-muted text-sm">{pool.description}</p>
          )}
        </div>

        <div className="px-6 mb-6">
          <ProgressBar
            total={pool.total || '0'}
            goal={pool.goalAmount}
            percentage={percentage}
          />
        </div>

        <div className="px-6 pb-6 flex flex-wrap gap-4 text-xs font-medium text-muted/80">
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

        <div className="bg-surface/50 border-t border-border p-6 relative">
          {pool.status === 'closed' ? (
            <div className="text-center">
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
            <div>
              {!authLoading && !user ? (
                <div className="flex flex-col items-center">
                  <p className="text-sm text-muted mb-4 text-center">Inicia sesión para poder realizar una contribución.</p>
                  <LoginButton />
                </div>
              ) : balanceLoading ? (
                <div className="flex flex-col items-center py-6">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                  <p className="text-sm text-muted text-center font-medium">Esperando tu saldo USDC...</p>
                </div>
              ) : currency !== 'USDC' ? (
                <div className="flex flex-col items-center py-6">
                  <div className="bg-error-light text-error p-4 rounded-xl font-medium shadow-sm border border-error-border text-center">
                    Tu cuenta no tiene USDC habilitado.
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="amount" className="block text-sm font-semibold text-foreground">
                      Monto a contribuir (USDC)
                    </label>
                    {balance !== null && (
                      <div className="text-sm font-medium text-muted flex items-center gap-2">
                        <span>Disponible: {parseFloat(balance).toFixed(2)}</span>
                        <button
                          onClick={() => {
                            const available = parseFloat(balance);
                            const toGoal = maxAllowed;
                            setAmount(Math.min(available, toGoal).toFixed(2));
                          }}
                          className="text-primary hover:text-primary-hover hover:bg-primary/10 px-2 py-0.5 rounded transition-colors text-xs border border-primary/20"
                        >
                          Máximo
                        </button>
                      </div>
                    )}
                  </div>

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
                    className="mb-4 bg-background"
                    disabled={isRegistering}
                  />

                  {registerError && (
                    <p className="rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error mb-4">
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
                      <p className="text-xs text-primary mt-2 text-center animate-pulse font-medium">
                        Registrando contribución...
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
      {user && <BottomNav />}
    </main>
  );
}
