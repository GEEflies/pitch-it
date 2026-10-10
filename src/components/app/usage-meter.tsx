/** Čerpanie limitu: číslo je hlavná informácia, pruh iba podpora. */
export function UsageMeter({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const exhausted = used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] text-mute">{label}</span>
        <span className={`text-[14.5px] tabular-nums ${exhausted ? "text-marker" : "text-paper"}`}>
          {used} z {limit} {unit}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
      >
        <div
          className={`h-full rounded-full ${exhausted ? "bg-marker" : "bg-signal"}`}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 3 : 0)}%` }}
        />
      </div>
    </div>
  );
}
