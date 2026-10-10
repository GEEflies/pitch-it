/** Zástupný blok počas načítania. Pulzuje iba pri povolenom pohybe. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-[8px] bg-panel ${className}`} />;
}

export function PageSkeleton({ label = "Načítavam…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
