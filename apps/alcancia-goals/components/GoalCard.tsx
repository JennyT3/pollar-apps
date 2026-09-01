import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { formatAmount } from "@/lib/format";
import type { GoalWithProgress } from "@/lib/api";

export function GoalCard({ goal }: { goal: GoalWithProgress }) {
  const pct = Math.round(goal.progress * 100);
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm transition-colors hover:bg-surface"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-2xl">
            {goal.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{goal.name}</p>
            <p className="text-xs text-muted">
              {goal.mode === "personal" ? "Personal" : "Compartida"}
              {goal.status !== "active" && ` · ${goal.status === "completed" ? "Completada" : "Archivada"}`}
            </p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold text-muted">{pct}%</span>
      </div>
      <ProgressBar progress={goal.progress} />
      <p className="font-mono text-sm text-muted">
        {formatAmount(goal.saved)} / {formatAmount(goal.targetAmount)} {goal.currency}
      </p>
    </Link>
  );
}
