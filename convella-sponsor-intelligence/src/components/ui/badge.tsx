import type { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-900/40",
  warning: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-900/40",
  danger: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-900/40",
  info: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-900/40",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

const ANALYSIS_STATUS_TONE: Record<string, BadgeTone> = {
  NOT_STARTED: "neutral",
  QUEUED: "info",
  PROCESSING: "info",
  SPONSOR_FOUND: "success",
  NO_SPONSOR_FOUND: "neutral",
  FAILED: "danger",
  PARTIAL: "warning",
  HUMAN_REVIEW_REQUIRED: "warning",
};

export function AnalysisStatusBadge({ status }: { status: string }) {
  return <Badge tone={ANALYSIS_STATUS_TONE[status] ?? "neutral"}>{status.replaceAll("_", " ")}</Badge>;
}

const REVIEW_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  REJECTED: "danger",
  EDITED: "info",
  ORGANIC: "neutral",
};

export function ReviewStatusBadge({ status }: { status: string }) {
  return <Badge tone={REVIEW_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

const JOB_STATUS_TONE: Record<string, BadgeTone> = {
  QUEUED: "info",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export function JobStatusBadge({ status }: { status: string }) {
  return <Badge tone={JOB_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

export function ConfidenceBadge({ score }: { score: number }) {
  const tone: BadgeTone = score >= 0.9 ? "success" : score >= 0.75 ? "info" : score >= 0.5 ? "warning" : "danger";
  return <Badge tone={tone}>{Math.round(score * 100)}%</Badge>;
}
