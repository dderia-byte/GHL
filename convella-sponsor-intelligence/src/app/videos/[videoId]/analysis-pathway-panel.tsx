import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEnv } from "@/lib/env";

type StageOneStatus = "Not started" | "Processing" | "Sponsor found" | "Completed" | "Failed";
type StageTwoStatus = "Not needed" | "Skipped" | "Processing" | "Sponsor found" | "Completed" | "Failed";
type StageThreeStatus = "Disabled" | "Not needed" | "Skipped" | "Processing" | "Sponsor found" | "Completed" | "Failed" | "Cost limit reached";

export interface AnalysisUsageData {
  resolvedAtStage: number | null;
  textModelCalls: number;
  reasoningModelCalls: number;
  videoModelCalls: number;
  transcriptCharactersSent: number;
  nativeVideoSecondsAnalysed: number;
  totalEstimatedCost: number;
  costLimitReached: boolean;
  skippedExpensiveReason: string | null;
  nativeAudioUsed: boolean;
  visualAnalysisUsed: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Sponsor found" || status === "Completed"
      ? "success"
      : status === "Failed" || status === "Cost limit reached"
        ? "danger"
        : status === "Processing"
          ? "info"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

function deriveStages(
  jobStatus: string | undefined,
  usage: AnalysisUsageData | null,
  nativeVideoEnabled: boolean,
): { stageOne: StageOneStatus; stageTwo: StageTwoStatus; stageThree: StageThreeStatus } {
  if (!jobStatus || jobStatus === "QUEUED") {
    return { stageOne: "Not started", stageTwo: "Not needed", stageThree: nativeVideoEnabled ? "Not needed" : "Disabled" };
  }
  if (jobStatus === "PROCESSING" && !usage) {
    return { stageOne: "Processing", stageTwo: "Not needed", stageThree: nativeVideoEnabled ? "Not needed" : "Disabled" };
  }
  if (jobStatus === "FAILED" && !usage) {
    return { stageOne: "Failed", stageTwo: "Not needed", stageThree: nativeVideoEnabled ? "Not needed" : "Disabled" };
  }
  if (!usage) {
    return { stageOne: "Not started", stageTwo: "Not needed", stageThree: nativeVideoEnabled ? "Not needed" : "Disabled" };
  }

  const stageOne: StageOneStatus = usage.resolvedAtStage === 1 ? "Sponsor found" : "Completed";

  let stageTwo: StageTwoStatus;
  if (usage.resolvedAtStage === 1) stageTwo = "Skipped";
  else if (usage.resolvedAtStage === 2) stageTwo = "Sponsor found";
  else if (usage.transcriptCharactersSent === 0) stageTwo = "Not needed";
  else stageTwo = "Completed";

  let stageThree: StageThreeStatus;
  if (!nativeVideoEnabled) stageThree = "Disabled";
  else if (usage.resolvedAtStage === 1 || usage.resolvedAtStage === 2) stageThree = "Skipped";
  else if (usage.resolvedAtStage === 3) stageThree = "Sponsor found";
  else if (usage.costLimitReached) stageThree = "Cost limit reached";
  else if (usage.videoModelCalls === 0 && usage.skippedExpensiveReason) stageThree = "Skipped";
  else if (usage.videoModelCalls === 0) stageThree = "Not needed";
  else stageThree = "Completed";

  return { stageOne, stageTwo, stageThree };
}

/**
 * Shows exactly how (and how cheaply) the current sponsor was resolved: which of the
 * three cost-optimised stages actually ran, what each one cost, and — critically —
 * whether native audio/visual analysis genuinely happened, never just because a later
 * stage was reached.
 */
export function AnalysisPathwayPanel({ jobStatus, usage }: { jobStatus: string | undefined; usage: AnalysisUsageData | null }) {
  const env = getEnv();
  const { stageOne, stageTwo, stageThree } = deriveStages(jobStatus, usage, env.ENABLE_NATIVE_VIDEO_ANALYSIS);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Analysis pathway</h2>
      <p className="mt-1 text-xs text-slate-500">Free deterministic → cheap transcript → expensive native video, stopping at the earliest reliable stage.</p>

      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">Stage 1 — Description &amp; metadata</dt>
          <dd>
            <StatusBadge status={stageOne} />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">Stage 2 — Targeted transcript</dt>
          <dd>
            <StatusBadge status={stageTwo} />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">Stage 3 — Native video &amp; audio</dt>
          <dd>
            <StatusBadge status={stageThree} />
          </dd>
        </div>
      </dl>

      {usage && (
        <>
          <dl className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Resolved at stage</dt>
              <dd className="font-medium text-slate-700">{usage.resolvedAtStage ?? "Unresolved"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Cheap text model calls</dt>
              <dd className="font-medium text-slate-700">{usage.textModelCalls}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Reasoning model calls</dt>
              <dd className="font-medium text-slate-700">{usage.reasoningModelCalls}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Native video calls</dt>
              <dd className="font-medium text-slate-700">{usage.videoModelCalls}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Transcript characters sent</dt>
              <dd className="font-medium text-slate-700">{usage.transcriptCharactersSent.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Native video seconds analysed</dt>
              <dd className="font-medium text-slate-700">{usage.nativeVideoSecondsAnalysed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Total estimated cost</dt>
              <dd className="font-medium text-slate-700">${usage.totalEstimatedCost.toFixed(4)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Est. spend avoided by stopping early</dt>
              <dd className="font-medium text-slate-700">
                ${Math.max(0, env.MAX_ESTIMATED_COST_PER_VIDEO_USD - usage.totalEstimatedCost).toFixed(4)}
              </dd>
            </div>
          </dl>

          {usage.skippedExpensiveReason && (
            <p className="mt-3 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
              {usage.skippedExpensiveReason}
            </p>
          )}
          {usage.costLimitReached && (
            <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
              Cost limit reached before a sponsor could be confirmed — see &quot;Inputs actually analysed&quot; below and the review queue for the best candidate found so far.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
