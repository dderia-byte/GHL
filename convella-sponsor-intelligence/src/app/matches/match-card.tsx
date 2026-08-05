"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, Mail } from "lucide-react";
import type { CreatorDecision } from "@/generated/prisma/enums";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MatchRow } from "@/lib/matching/queries";
import { recordDecisionAction } from "./actions";

const RECOMMENDATION_TONE: Record<string, "success" | "info" | "warning" | "neutral" | "danger"> = {
  STRONG_MATCH: "success",
  GOOD_MATCH: "info",
  NEEDS_MORE_RESEARCH: "warning",
  WEAK_MATCH: "neutral",
  REJECT: "danger",
};

const DECISIONS: { value: CreatorDecision; label: string }[] = [
  { value: "APPROVE", label: "Approve" },
  { value: "GOOD_FIT", label: "Good fit" },
  { value: "CONTACT_LATER", label: "Contact later" },
  { value: "NEEDS_MORE_RESEARCH", label: "Needs more research" },
  { value: "WRONG_AUDIENCE", label: "Wrong audience" },
  { value: "WEAK_VIEWS", label: "Weak views" },
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "NOT_RELEVANT", label: "Not relevant" },
  { value: "ALREADY_CONTACTED", label: "Already contacted" },
  { value: "DUPLICATE", label: "Duplicate" },
  { value: "REJECT", label: "Reject" },
];

function num(value: number | null, digits = 0): string {
  return value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** A score bar that shows match and confidence as two distinct dimensions. */
function ScoreBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-[112px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}<span className="text-[11px] font-normal text-muted-foreground">/100</span></span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, value)}%` }} />
      </div>
    </div>
  );
}

export function MatchCard({ match }: { match: MatchRow }) {
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState<CreatorDecision>("APPROVE");
  const [reason, setReason] = useState("");
  const [humanScore, setHumanScore] = useState("");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(match.lastDecision);
  const [error, setError] = useState<string | undefined>();

  const positives = match.signals.filter((s) => s.kind === "positive");
  const negatives = match.signals.filter((s) => s.kind === "negative");
  const unknowns = match.signals.filter((s) => s.kind === "unknown");

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/channels/${match.channelId}`}
              className="text-base font-semibold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              {match.channelName}
            </Link>
            <Badge tone={RECOMMENDATION_TONE[match.recommendation] ?? "neutral"}>
              {match.recommendation.replaceAll("_", " ")}
            </Badge>
            {saved && <Badge tone="info">you said: {saved.replaceAll("_", " ").toLowerCase()}</Badge>}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {match.primaryNiche ?? "Niche unknown"} · {num(match.subscriberCount)} subs ·{" "}
            <span className="font-medium text-foreground/80">{num(match.medianViews)} median long-form views</span>
            {match.shortsRatio !== null && match.shortsRatio > 0.5 && (
              <span className="text-amber-700 dark:text-amber-400"> · {Math.round(match.shortsRatio * 100)}% Shorts</span>
            )}
            {match.uploadsPerMonth !== null && ` · ${match.uploadsPerMonth.toFixed(1)} uploads/mo`}
          </p>

          <p className="mt-2 text-sm text-foreground/90">{match.explanation}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {match.latestSponsors.map((sponsor) => (
              <span key={sponsor} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{sponsor}</span>
            ))}
            {match.estimatedRate && (
              <span className="text-muted-foreground">
                Est. ${match.estimatedRate.low.toLocaleString("en-US")}–${match.estimatedRate.high.toLocaleString("en-US")}/integration
              </span>
            )}
            {match.businessEmail && (
              <a href={`mailto:${match.businessEmail}`} className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                <Mail className="size-3" /> {match.businessEmail}
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-4">
          <ScoreBar label="Match" value={match.manualScore ?? match.matchScore} tone="bg-indigo-500" />
          <ScoreBar
            label="Confidence"
            value={match.confidenceScore}
            tone={match.confidenceScore >= 65 ? "bg-emerald-500" : match.confidenceScore >= 45 ? "bg-amber-500" : "bg-rose-500"}
          />
        </div>
      </div>

      {/* Signals: positive / negative / unknown kept visually distinct. */}
      {(positives.length > 0 || negatives.length > 0 || unknowns.length > 0) && (
        <div className="flex flex-col gap-1.5 border-t border-border px-5 py-3">
          {negatives.map((s) => (
            <p key={s.code} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {s.message}
            </p>
          ))}
          {positives.map((s) => (
            <p key={s.code} className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> {s.message}
            </p>
          ))}
          {unknowns.map((s) => (
            <p key={s.code} className="flex items-start gap-2 text-xs text-muted-foreground">
              <HelpCircle className="mt-0.5 size-3.5 shrink-0" /> {s.message}
            </p>
          ))}
        </div>
      )}

      <div className="border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Hide" : "Show"} score breakdown ({match.evidenceCount} evidence records)
        </button>

        {expanded && (
          <table className="mt-3 w-full text-xs">
            <tbody className="divide-y divide-border">
              {match.components.map((c) => (
                <tr key={c.key}>
                  <td className="py-2 pr-3 font-medium text-foreground">{c.label}</td>
                  <td className="w-24 py-2 pr-3 text-muted-foreground">
                    {c.points.toFixed(1)} / {c.maxPoints}
                    {c.unknown && <span className="ml-1 text-amber-600 dark:text-amber-400">(unknown)</span>}
                  </td>
                  <td className="py-2 text-muted-foreground">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Decision capture — the training signal for accuracy measurement. */}
      <div className="flex flex-wrap items-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          Your decision
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as CreatorDecision)}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          >
            {DECISIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          Your score (optional)
          <input
            type="number"
            min={0}
            max={100}
            value={humanScore}
            onChange={(e) => setHumanScore(e.target.value)}
            placeholder="0–100"
            className="w-24 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          Reason (optional)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? This is what the system learns from."
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          />
        </label>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await recordDecisionAction({
                channelId: match.channelId,
                brandId: match.brandId,
                decision,
                reason,
                humanScore: humanScore === "" ? undefined : Number(humanScore),
              });
              setError(result.error);
              if (!result.error) {
                setSaved(decision);
                setReason("");
                setHumanScore("");
              }
            })
          }
        >
          {pending ? "Saving…" : "Record decision"}
        </Button>
        {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      </div>
    </Card>
  );
}
