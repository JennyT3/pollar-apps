"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { LoginButton } from "@/components/LoginButton";
import { Spinner } from "@/components/ui/Spinner";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount } from "@/lib/format";
import { getGoalDetail, joinGoal, type GoalDetail } from "@/lib/api";

function JoinContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = usePollarAuth();
  const goalId = params.get("goal");
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) return;
    void getGoalDetail(goalId)
      .then(setDetail)
      .catch(() => setError("Esta meta no existe."));
  }, [goalId]);

  if (!goalId) {
    return <EmptyState title="Falta el link de la meta" description="Pedí que te reenvíen el QR o el link de invitación." />;
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

  async function join() {
    if (!user) return;
    setJoining(true);
    try {
      await joinGoal(goal.id, user.address);
      router.push(`/goals/${goal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos unirte, probá de nuevo.");
      setJoining(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-4xl">
        {goal.emoji}
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{goal.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Meta compartida · {formatAmount(goal.saved)} / {formatAmount(goal.targetAmount)}{" "}
          {goal.currency}
        </p>
      </div>
      {!user ? (
        <>
          <p className="text-sm text-muted">Iniciá sesión con Pollar para unirte a esta meta.</p>
          <LoginButton />
        </>
      ) : (
        <Button onClick={() => void join()} loading={joining} className="w-full py-3">
          Unirme a esta meta
        </Button>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Suspense fallback={<Spinner size={24} />}>
        <JoinContent />
      </Suspense>
    </main>
  );
}
