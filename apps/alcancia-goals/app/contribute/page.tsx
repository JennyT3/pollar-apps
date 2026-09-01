"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContributeFlow } from "@/components/ContributeFlow";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoginButton } from "@/components/LoginButton";
import { Spinner } from "@/components/ui/Spinner";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount } from "@/lib/format";
import { getGoalDetail, type GoalDetail } from "@/lib/api";
import { compareAmounts, subtractAmounts } from "@/lib/decimal";

function ContributeContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = usePollarAuth();
  const goalId = params.get("goal");
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) return;
    void getGoalDetail(goalId)
      .then(setDetail)
      .catch(() => setError("Esta meta no existe."));
  }, [goalId]);

  if (!goalId) {
    return <EmptyState title="Falta el link de la meta" description="Pedí que te reenvíen el QR de contribución." />;
  }
  if (error) {
    return <EmptyState title="No encontramos esa meta" description={error} />;
  }
  if (!detail) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={24} />
      </div>
    );
  }

  const { goal } = detail;

  if (goal.mode !== "shared" || !goal.keeperAddress) {
    return <EmptyState title="Esta meta no acepta contribuciones" description="Solo las metas compartidas se pagan por QR." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-4xl">
          {goal.emoji}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{goal.name}</h1>
        <p className="text-sm text-muted">
          {formatAmount(goal.saved)} / {formatAmount(goal.targetAmount)} {goal.currency}
        </p>
      </div>

      {!user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-sm text-muted">
            Iniciá sesión con Pollar para contribuir a esta meta.
          </p>
          <LoginButton />
        </div>
      ) : (
        <ContributeFlow
          goalId={goal.id}
          keeperAddress={goal.keeperAddress}
          currency={goal.currency}
          remaining={compareAmounts(goal.saved, goal.targetAmount) >= 0 ? "0" : subtractAmounts(goal.targetAmount, goal.saved)}
          onContributed={() => router.push(`/goals/${goal.id}`)}
        />
      )}
    </div>
  );
}

export default function ContributePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Suspense fallback={<Spinner size={24} />}>
        <ContributeContent />
      </Suspense>
    </main>
  );
}
