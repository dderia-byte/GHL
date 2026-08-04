import type { CandidateState } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit/log";
import { buildDiscoverySettingsSnapshot, type DiscoverySettingsSnapshot } from "@/lib/settings";
import { enqueueCreatorQualificationJob, enqueueDiscoveryRunJob } from "@/lib/jobs/queue";

export const TERMINAL_CANDIDATE_STATES: CandidateState[] = [
  "FILTERED_OUT",
  "COMPLETED",
  "REJECTED_NOT_COMMERCIAL",
  "REJECTED_NO_SPONSOR",
  "CANCELLED",
  "ERRORED",
];

/** States a paused/halted run's candidates can be resumed from. */
const RESUMABLE_CANDIDATE_STATES: CandidateState[] = [
  "PENDING_ANALYSIS",
  "ANALYSING_NEWEST",
  "CHECKING_SIGNALS",
  "ANALYSING_SECOND",
  "QUALIFIED",
  "DEEP_SCANNING",
  "QUALIFIED_PARTIAL",
];

export class DiscoveryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryConflictError";
  }
}

/**
 * Creates a DiscoveryRun (with the settings snapshot frozen at this instant) and its
 * DISCOVERY_RUN job. One run at a time: a QUEUED/RUNNING/PAUSED run blocks a new one
 * (halted runs don't — they are parked awaiting a budget change, and the shared
 * budget ledgers protect against double spend either way).
 */
export async function startDiscoveryRun(options: { trigger: "manual" | "scheduled"; actorId?: string }) {
  const active = await prisma.discoveryRun.findFirst({
    where: { status: { in: ["QUEUED", "RUNNING", "PAUSED"] } },
  });
  if (active) {
    throw new DiscoveryConflictError(
      `A discovery run is already ${active.status.toLowerCase()} (started ${active.createdAt.toISOString()}). ` +
        `Wait for it to finish, or cancel it first.`,
    );
  }

  const enabledQueries = await prisma.discoveryQuery.count({ where: { enabled: true } });
  if (enabledQueries === 0) {
    throw new DiscoveryConflictError("No enabled discovery queries — configure at least one search query first.");
  }

  const snapshot = await buildDiscoverySettingsSnapshot();
  const run = await prisma.discoveryRun.create({
    data: {
      trigger: options.trigger,
      settingsSnapshot: JSON.parse(JSON.stringify(snapshot)),
    },
  });
  await enqueueDiscoveryRunJob(run.id);
  await recordAudit({
    actorType: options.trigger === "manual" ? "user" : "system",
    actorId: options.actorId,
    action: "discovery.run.started",
    entityType: "DiscoveryRun",
    entityId: run.id,
    detail: { trigger: options.trigger, snapshot: JSON.parse(JSON.stringify(snapshot)) },
  });
  return run;
}

export function parseSettingsSnapshot(raw: unknown): DiscoverySettingsSnapshot {
  // The snapshot was written by buildDiscoverySettingsSnapshot; the spread-over-
  // defaults keeps old runs readable if new snapshot fields are added later.
  const defaults: DiscoverySettingsSnapshot = {
    qualifiedTarget: 30,
    maxCandidatesPerRun: 150,
    maxCreatorsPerRun: 40,
    maxConcurrentCreators: 1,
    deepScanVideoCount: 5,
    maxSubscribers: 800_000,
    allowHiddenSubscriberCounts: false,
    maxVideoAgeDays: 90,
    rejectionCooldownDays: 90,
    maxPagesPerQuery: 2,
    maxGatingPaidVideos: 2,
    minIntervalHours: 20,
    dailyCostLimitUsd: 25,
    perRunCostLimitUsd: 10,
    dailyQuotaUnits: 8_000,
  };
  if (raw && typeof raw === "object") return { ...defaults, ...(raw as Partial<DiscoverySettingsSnapshot>) };
  return defaults;
}

export async function pauseDiscoveryRun(runId: string, actorId?: string) {
  const result = await prisma.discoveryRun.updateMany({
    where: { id: runId, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "PAUSED" },
  });
  if (result.count === 0) throw new DiscoveryConflictError("Only a queued or running run can be paused.");
  await recordAudit({ actorType: "user", actorId, action: "discovery.run.paused", entityType: "DiscoveryRun", entityId: runId });
}

/**
 * Resumes a paused or halted run: flips it back to RUNNING (making its queued jobs
 * visible to the claim filter again) and re-enqueues qualification jobs for any
 * resumable candidate that lost its job (e.g. a halt requeued it and it was later
 * cancelled, or attempts were exhausted while halted). The candidate state machine
 * plus hash-reuse guarantee no completed work is repeated.
 */
export async function resumeDiscoveryRun(runId: string, actorId?: string) {
  const result = await prisma.discoveryRun.updateMany({
    where: { id: runId, status: { in: ["PAUSED", "HALTED_COST_LIMIT", "HALTED_QUOTA_LIMIT"] } },
    data: { status: "RUNNING", cancelRequested: false },
  });
  if (result.count === 0) throw new DiscoveryConflictError("Only a paused or halted run can be resumed.");

  const resumableCandidates = await prisma.discoveryCandidate.findMany({
    where: { discoveryRunId: runId, state: { in: RESUMABLE_CANDIDATE_STATES } },
    select: { id: true },
  });
  for (const candidate of resumableCandidates) {
    await enqueueCreatorQualificationJob(runId, candidate.id);
  }

  await recordAudit({ actorType: "user", actorId, action: "discovery.run.resumed", entityType: "DiscoveryRun", entityId: runId });
}

/**
 * Requests cancellation. Queued jobs are cancelled immediately; a processing handler
 * observes cancelRequested cooperatively between videos/candidates. Completed
 * analyses and detections are kept — they were paid for and are valid intelligence.
 */
export async function cancelDiscoveryRun(runId: string, actorId?: string) {
  const run = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: runId } });
  if (["COMPLETED", "CANCELLED", "FAILED"].includes(run.status)) {
    throw new DiscoveryConflictError("This run has already finished.");
  }

  await prisma.discoveryRun.update({
    where: { id: runId },
    data: { cancelRequested: true, status: "CANCELLED", completedAt: new Date() },
  });
  await prisma.analysisJob.updateMany({
    where: { discoveryRunId: runId, status: "QUEUED" },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  await prisma.discoveryCandidate.updateMany({
    where: { discoveryRunId: runId, state: { notIn: TERMINAL_CANDIDATE_STATES } },
    data: { state: "CANCELLED" },
  });
  await recordAudit({ actorType: "user", actorId, action: "discovery.run.cancelled", entityType: "DiscoveryRun", entityId: runId });
}

export interface ContinuationDecision {
  action: "CONTINUE" | "STOP";
  stopReason?: string;
}

/**
 * Decides whether a run should search for more candidates. Pure so the stopping
 * rules are directly testable: stop at the qualified target, at the candidate
 * ceiling, or when searches stop yielding anyone new.
 */
export function decideContinuation(state: {
  qualifiedCount: number;
  candidatesAnalysed: number;
  qualifiedTarget: number;
  maxCandidatesPerRun: number;
  searchExhausted: boolean;
}): ContinuationDecision {
  if (state.qualifiedCount >= state.qualifiedTarget) {
    return { action: "STOP", stopReason: `Reached the target of ${state.qualifiedTarget} new qualified creators.` };
  }
  if (state.candidatesAnalysed >= state.maxCandidatesPerRun) {
    return {
      action: "STOP",
      stopReason: `Reached the maximum of ${state.maxCandidatesPerRun} analysed candidates with ${state.qualifiedCount} qualified creator(s) found — exporting the partial results.`,
    };
  }
  if (state.searchExhausted) {
    return {
      action: "STOP",
      stopReason: `Searches returned no further new creators; found ${state.qualifiedCount} of ${state.qualifiedTarget}.`,
    };
  }
  return { action: "CONTINUE" };
}

/**
 * Marks the run COMPLETED once every candidate is terminal — called by the
 * qualification handler after each candidate finishes. A run that was halted or
 * cancelled keeps that status (it is not "completed", even if nothing is left to do).
 */
export async function finalizeRunIfDone(runId: string) {
  const run = await prisma.discoveryRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== "RUNNING" && run.status !== "QUEUED") return;

  const unfinished = await prisma.discoveryCandidate.count({
    where: { discoveryRunId: runId, state: { notIn: TERMINAL_CANDIDATE_STATES } },
  });
  if (unfinished > 0) return;

  // Every candidate is done. Either the run has met a stopping condition, or it must
  // search again for more candidates until it does.
  const settings = parseSettingsSnapshot(run.settingsSnapshot);
  const decision = decideContinuation({
    qualifiedCount: run.qualifiedCount,
    candidatesAnalysed: run.candidatesAnalysed,
    qualifiedTarget: settings.qualifiedTarget,
    maxCandidatesPerRun: settings.maxCandidatesPerRun,
    searchExhausted: Boolean((run.searchCursors as { exhausted?: boolean } | null)?.exhausted),
  });

  if (decision.action === "CONTINUE") {
    await enqueueDiscoveryRunJob(runId);
    await recordAudit({
      actorType: "worker",
      action: "discovery.run.continuing",
      entityType: "DiscoveryRun",
      entityId: runId,
      detail: { qualifiedCount: run.qualifiedCount, candidatesAnalysed: run.candidatesAnalysed },
    });
    return;
  }

  await prisma.discoveryRun.update({
    where: { id: runId },
    data: { status: "COMPLETED", completedAt: new Date(), stopReason: decision.stopReason },
  });
  await recordAudit({
    actorType: "worker",
    action: "discovery.run.completed",
    entityType: "DiscoveryRun",
    entityId: runId,
  });
}
