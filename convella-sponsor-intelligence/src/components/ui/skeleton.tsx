export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

/** Skeleton placeholder matching the shape of an AnalyticsCard, for dashboard loading states. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <Skeleton className="size-9 rounded-lg" />
      <Skeleton className="mt-3 h-3.5 w-24" />
      <Skeleton className="mt-2 h-7 w-16" />
    </div>
  );
}

/** Skeleton rows for a table-shaped loading state. */
export function TableRowsSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3.5">
          {Array.from({ length: columns }).map((__, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? "w-1/3" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
