export function ProgressBar({
  progress,
  className = "",
}: {
  /** 0..1 */
  progress: number;
  className?: string;
}) {
  const pct = Math.round(progress * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-3 w-full overflow-hidden rounded-full bg-surface ${className}`}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
