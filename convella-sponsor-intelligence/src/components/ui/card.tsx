import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 shadow-soft ${className}`}>{children}</div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p> : null}
    </Card>
  );
}

const ACCENT_CLASSES = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
} as const;

export type AnalyticsCardAccent = keyof typeof ACCENT_CLASSES;

/**
 * Premium analytics card for dashboard-style metrics: icon in a soft colour-accented
 * badge, title, main metric, and an optional trend indicator (positive/negative
 * percentage change against a prior period).
 */
export function AnalyticsCard({
  icon: Icon,
  label,
  value,
  accent = "indigo",
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  accent?: AnalyticsCardAccent;
  trend?: { value: number; label?: string } | null;
}) {
  const trendPositive = trend !== undefined && trend !== null && trend.value >= 0;

  return (
    <Card className="transition-shadow duration-150 hover:shadow-medium">
      <div className="flex items-start justify-between">
        <span className={`inline-flex size-9 items-center justify-center rounded-lg ${ACCENT_CLASSES[accent]}`}>
          <Icon className="size-5" />
        </span>
        {trend !== undefined && trend !== null && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
              trendPositive
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
            }`}
          >
            {trendPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {trend?.label && <p className="mt-1 text-xs text-muted-foreground/80">{trend.label}</p>}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-card/50 px-6 py-16 text-center">
      {Icon && (
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
