"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ContributeFlow } from "@/components/ContributeFlow";
import { CoverageBanner } from "@/components/CoverageBanner";
import { GoalQR } from "@/components/GoalQR";
import { HistoryList } from "@/components/HistoryList";
import { ProgressBar } from "@/components/ProgressBar";
import { SetAsideModal } from "@/components/SetAsideModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount, shortAddress } from "@/lib/format";
import { getGoalDetail, setGoalStatus, type GoalDetail } from "@/lib/api";

function daysLeft(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = usePollarAuth();
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);

  async function reload() {
    try {
      const d = await getGoalDetail(id);
      setDetail(d);
    } catch {
      setNotFound(true);
    }
  }

  useEffect(() => {
    void getGoalDetail(id).then(setDetail).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <p className="text-lg font-semibold">Esta meta no existe</p>
        <Link href="/" className="text-sm text-primary hover:underline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (!detail || !user) {
    return (
      <main className="flex flex-1 items-center justify-center py-20">
        <Spinner size={24} />
      </main>
    );
  }

  const { goal, history, shared } = detail;
  const userAddress = user.address;
  const isOwner = goal.ownerAddress === userAddress;
  const isPersonal = goal.mode === "personal";
  const canComplete = goal.status === "active" && goal.progress >= 1;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${origin}/join?goal=${goal.id}`;
  const contributeUrl = `${origin}/contribute?goal=${goal.id}`;

  async function complete() {
    await setGoalStatus(goal.id, "completed", userAddress);
    void reload();
  }

  async function archive() {
    await setGoalStatus(goal.id, "archived", userAddress);
    void reload();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6 lg:max-w-lg lg:py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Metas
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-3xl">
          {goal.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{goal.name}</h1>
          <p className="text-xs text-muted">
            {isPersonal ? "Meta personal" : "Meta compartida"}
            {goal.deadline && ` · ${daysLeft(goal.deadline)} días para el límite`}
          </p>
        </div>
      </div>

      {goal.status === "completed" && (
        <div className="rounded-2xl border border-success-border bg-success-light px-4 py-3 text-center text-sm font-semibold text-success">
          🎉 ¡Meta alcanzada!
        </div>
      )}

      {isPersonal && <CoverageBanner />}

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {formatAmount(goal.saved)}
          </span>
          <span className="font-mono text-sm text-muted">
            de {formatAmount(goal.targetAmount)} {goal.currency}
          </span>
        </div>
        <ProgressBar progress={goal.progress} />
        <p className="text-sm text-muted">
          {Math.round(goal.progress * 100)}% completado · faltan{" "}
          <span className="font-mono">
            {formatAmount(String(Math.max(0, Number(goal.targetAmount) - Number(goal.saved))))}{" "}
            {goal.currency}
          </span>
        </p>
      </Card>

      {isPersonal && isOwner && goal.status === "active" && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => setAddOpen(true)}>Apartar</Button>
          <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>
            Retirar
          </Button>
        </div>
      )}

      {!isPersonal && goal.status === "active" && (
        <>
          <Button onClick={() => setContributeOpen(true)} className="w-full py-3">
            Contribuir
          </Button>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GoalQR url={contributeUrl} caption="Escaneá para contribuir a esta meta" />
            <GoalQR url={inviteUrl} caption="Escaneá para unirte a esta meta" />
          </div>
        </>
      )}

      {shared && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            Miembros · keeper {shortAddress(goal.keeperAddress ?? "")}
          </h2>
          {shared.memberTotals.length === 0 ? (
            <p className="text-sm text-muted">Nadie contribuyó todavía.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shared.memberTotals.map((m) => (
                <li key={m.address} className="flex items-center justify-between text-sm">
                  <span>{m.address === user.address ? "Vos" : shortAddress(m.address)}</span>
                  <span className="font-mono font-medium">
                    {formatAmount(m.total)} {goal.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {isOwner && (canComplete || goal.status !== "archived") && (
        <div className="flex gap-3">
          {canComplete && (
            <Button onClick={() => void complete()} className="flex-1">
              Marcar como completada
            </Button>
          )}
          {goal.status !== "archived" && (
            <Button variant="secondary" onClick={() => void archive()} className="flex-1">
              Archivar
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Historial
        </h2>
        <HistoryList entries={history} currency={goal.currency} youAddress={user.address} />
      </div>

      <SetAsideModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        goalId={goal.id}
        address={user.address}
        currency={goal.currency}
        type="add"
        onDone={() => void reload()}
      />
      <SetAsideModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        goalId={goal.id}
        address={user.address}
        currency={goal.currency}
        type="withdraw"
        onDone={() => void reload()}
      />
      <Modal open={contributeOpen} onClose={() => setContributeOpen(false)} title="Contribuir">
        {goal.keeperAddress && (
          <ContributeFlow
            goalId={goal.id}
            keeperAddress={goal.keeperAddress}
            contributorAddress={user.address}
            currency={goal.currency}
            onContributed={() => void reload()}
          />
        )}
      </Modal>
    </main>
  );
}
