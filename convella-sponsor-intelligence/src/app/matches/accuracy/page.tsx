import Link from "next/link";
import { Gauge, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp } from "lucide-react";
import { buildAccuracyReport } from "@/lib/matching/feedback";
import { PageHeader, Card, AnalyticsCard, EmptyState } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/** Below this many decisions, rates are anecdote — say so rather than implying precision. */
const MEANINGFUL_SAMPLE = 10;

export default async function AccuracyPage() {
  const report = await buildAccuracyReport();

  if (report.totalDecisions === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Accuracy" description="How the system's recommendations compare with your judgement." />
        <EmptyState
          icon={Gauge}
          title="No decisions recorded yet"
          description="Approve or reject creators on the Brand matches page. Once decisions accumulate, this page measures the system against your judgement."
        />
      </div>
    );
  }

  const lowSample = report.totalDecisions < MEANINGFUL_SAMPLE;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accuracy"
        description="Measured against your recorded decisions — not a claim, a comparison."
      />

      {lowSample && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-500/10">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Only {report.totalDecisions} decision{report.totalDecisions === 1 ? "" : "s"} recorded. The rates below are
            not yet statistically meaningful — treat them as indicative until you have {MEANINGFUL_SAMPLE}+ decisions.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AnalyticsCard icon={Gauge} label="Decisions recorded" value={report.totalDecisions} accent="indigo" />
        <AnalyticsCard icon={ThumbsUp} label="Approval precision (score ≥70)" value={pct(report.approvalPrecision)} accent="emerald" />
        <AnalyticsCard icon={ThumbsDown} label="Rejection precision (score <50)" value={pct(report.rejectionPrecision)} accent="sky" />
        <AnalyticsCard
          icon={TrendingUp}
          label="Mean human/system gap"
          value={report.meanScoreGap === null ? "—" : `${report.meanScoreGap.toFixed(1)} pts`}
          accent="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingDown className="size-4 text-rose-500" /> False positives
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Scored ≥70 by the system, rejected by you — over-weighted signals.</p>
          {report.falsePositives.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {report.falsePositives.slice(0, 10).map((row) => (
                <li key={`${row.channelId}-${row.decision}`} className="py-2 text-sm">
                  <Link href={`/channels/${row.channelId}`} className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400">
                    {row.channelName}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    scored {row.matchScore} · {row.decision.replaceAll("_", " ").toLowerCase()}
                    {row.reason ? ` — "${row.reason}"` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="size-4 text-emerald-500" /> False negatives
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Scored &lt;50 by the system, approved by you — signals the system is missing.</p>
          {report.falseNegatives.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {report.falseNegatives.slice(0, 10).map((row) => (
                <li key={`${row.channelId}-${row.decision}`} className="py-2 text-sm">
                  <Link href={`/channels/${row.channelId}`} className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400">
                    {row.channelName}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    scored {row.matchScore} · {row.decision.replaceAll("_", " ").toLowerCase()}
                    {row.reason ? ` — "${row.reason}"` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-foreground">Most common decisions</h2>
          <div className="mt-3 grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Rejections</p>
              <ul className="mt-2 flex flex-col gap-1">
                {report.topRejectionReasons.slice(0, 6).map((row) => (
                  <li key={row.decision} className="flex justify-between text-sm">
                    <span className="text-foreground">{row.decision.replaceAll("_", " ").toLowerCase()}</span>
                    <span className="text-muted-foreground">{row.count}</span>
                  </li>
                ))}
                {report.topRejectionReasons.length === 0 && <li className="text-sm text-muted-foreground">None yet.</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Approvals</p>
              <ul className="mt-2 flex flex-col gap-1">
                {report.topApprovalReasons.slice(0, 6).map((row) => (
                  <li key={row.decision} className="flex justify-between text-sm">
                    <span className="text-foreground">{row.decision.replaceAll("_", " ").toLowerCase()}</span>
                    <span className="text-muted-foreground">{row.count}</span>
                  </li>
                ))}
                {report.topApprovalReasons.length === 0 && <li className="text-sm text-muted-foreground">None yet.</li>}
              </ul>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-foreground">Signals that predict your rejections</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Signals appearing on creators you rejected, with at least 3 occurrences. High rates are candidates for
            increased weighting — reweight on repeated patterns, never on a single decision.
          </p>
          {report.signalsPredictingRejection.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Not enough repeated signals yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {report.signalsPredictingRejection.slice(0, 8).map((row) => (
                <li key={row.code} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{row.code.replaceAll("_", " ").toLowerCase()}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(row.rejectionRate * 100)}% rejected · {row.occurrences} seen
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
