"use client";

import { formatPoolAmount } from "@/lib/format";

interface ProgressBarProps {
  total: string;
  goal: string;
  percentage: number;
  currency?: string;
}

export function ProgressBar({
  total,
  goal,
  percentage,
  currency = "USDC",
}: ProgressBarProps) {
  const displayPercentage = Math.min(100, Math.max(0, percentage));
  const isComplete = percentage >= 100;

  return (
    <div className="w-full max-w-md mx-auto my-6 p-6 bg-surface rounded-2xl shadow-sm border border-border">
      <div className="flex justify-between items-baseline mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground tracking-tight">
            ${formatPoolAmount(total)}
          </span>
          <span className="text-muted font-medium">/ ${formatPoolAmount(goal)} {currency}</span>
        </div>
        <div className="text-2xl font-bold" style={{ color: isComplete ? "var(--success)" : "var(--primary)" }}>
          {Math.floor(percentage)}%
        </div>
      </div>

      <div className="h-4 w-full bg-border rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${displayPercentage}%`,
            background: isComplete
              ? "var(--success)"
              : "linear-gradient(90deg, var(--primary) 0%, var(--primary-hover) 100%)",
          }}
        />
      </div>

      {isComplete && (
        <p className="mt-4 text-center text-success font-semibold text-sm animate-pulse">
          ¡Meta alcanzada!
        </p>
      )}
    </div>
  );
}
