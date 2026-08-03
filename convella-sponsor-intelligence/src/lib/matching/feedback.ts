import type { CreatorDecision } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit/log";

/** Decisions that mean "yes, I'd work with this creator". */
const POSITIVE_DECISIONS: CreatorDecision[] = ["APPROVE", "GOOD_FIT", "CONTACT_LATER", "ALREADY_CONTACTED"];
/** Decisions that mean "no". */
const NEGATIVE_DECISIONS: CreatorDecision[] = [
  "REJECT",
  "NOT_RELEVANT",
  "TOO_EXPENSIVE",
  "WEAK_VIEWS",
  "WRONG_AUDIENCE",
  "DUPLICATE",
];

export function isPositiveDecision(decision: CreatorDecision): boolean {
  return POSITIVE_DECISIONS.includes(decision);
}
export function isNegativeDecision(decision: CreatorDecision): boolean {
  return NEGATIVE_DECISIONS.includes(decision);
}

/**
 * Records a human decision, snapshotting the system's scores and signals AS THEY WERE
 * at decision time. The snapshot is what makes accuracy measurable later: comparing a
 * decision against today's (possibly rescored) numbers would be meaningless.
 */
export async function recordCreatorFeedback(input: {
  channelId: string;
  brandId?: string | null;
  decision: CreatorDecision;
  reason?: string | null;
  humanScore?: number | null;
  decidedBy?: string | null;
}) {
  const match =
    input.brandId != null
      ? await prisma.creatorBrandMatch.findUnique({
          where: { channelId_brandId: { channelId: input.channelId, brandId: input.brandId } },
        })
      : null;

  const feedback = await prisma.creatorFeedback.create({
    data: {
      channelId: input.channelId,
      brandId: input.brandId ?? null,
      matchId: match?.id ?? null,
      decision: input.decision,
      reason: input.reason ?? null,
      humanScore: input.humanScore ?? null,
      matchScoreAtDecision: match?.matchScore ?? null,
      confidenceScoreAtDecision: match?.confidenceScore ?? null,
      signalsAtDecision: match?.signals ?? undefined,
      decidedBy: input.decidedBy ?? null,
    },
  });

  await recordAudit({
    actorType: "user",
    actorId: input.decidedBy ?? undefined,
    action: "creator.feedback.recorded",
    entityType: "CreatorFeedback",
    entityId: feedback.id,
    detail: { decision: input.decision, channelId: input.channelId, brandId: input.brandId ?? null },
  });

  return feedback;
}

export interface AccuracyReport {
  totalDecisions: number;
  approvals: number;
  rejections: number;
  /** Of creators the system scored highly (>=70), the share a human approved. */
  approvalPrecision: number | null;
  /** Of creators the system scored poorly (<50), the share a human also rejected. */
  rejectionPrecision: number | null;
  /** System said strong, human said no. */
  falsePositives: Array<{ channelId: string; channelName: string; matchScore: number; decision: string; reason: string | null }>;
  /** System said weak, human said yes — the misses that matter most. */
  falseNegatives: Array<{ channelId: string; channelName: string; matchScore: number; decision: string; reason: string | null }>;
  /** Mean |human score − system score| where the operator supplied their own score. */
  meanScoreGap: number | null;
  topRejectionReasons: Array<{ decision: string; count: number }>;
  topApprovalReasons: Array<{ decision: string; count: number }>;
  /** Signals that appear disproportionately on rejected creators — tuning candidates. */
  signalsPredictingRejection: Array<{ code: string; rejectionRate: number; occurrences: number }>;
}

const HIGH_SCORE_THRESHOLD = 70;
const LOW_SCORE_THRESHOLD = 50;

/**
 * Measures the system against human judgement. Deliberately reports raw counts
 * alongside rates: with a handful of decisions the rates are noise, and the counts
 * make that obvious rather than implying precision the data cannot support.
 */
export async function buildAccuracyReport(): Promise<AccuracyReport> {
  const feedback = await prisma.creatorFeedback.findMany({
    include: { channel: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const withScores = feedback.filter((f) => f.matchScoreAtDecision !== null);
  const positives = feedback.filter((f) => isPositiveDecision(f.decision));
  const negatives = feedback.filter((f) => isNegativeDecision(f.decision));

  const highScored = withScores.filter((f) => (f.matchScoreAtDecision as number) >= HIGH_SCORE_THRESHOLD);
  const lowScored = withScores.filter((f) => (f.matchScoreAtDecision as number) < LOW_SCORE_THRESHOLD);

  const approvalPrecision = highScored.length
    ? highScored.filter((f) => isPositiveDecision(f.decision)).length / highScored.length
    : null;
  const rejectionPrecision = lowScored.length
    ? lowScored.filter((f) => isNegativeDecision(f.decision)).length / lowScored.length
    : null;

  const falsePositives = highScored
    .filter((f) => isNegativeDecision(f.decision))
    .map((f) => ({
      channelId: f.channel.id,
      channelName: f.channel.name,
      matchScore: f.matchScoreAtDecision as number,
      decision: f.decision,
      reason: f.reason,
    }));

  const falseNegatives = lowScored
    .filter((f) => isPositiveDecision(f.decision))
    .map((f) => ({
      channelId: f.channel.id,
      channelName: f.channel.name,
      matchScore: f.matchScoreAtDecision as number,
      decision: f.decision,
      reason: f.reason,
    }));

  const gaps = feedback
    .filter((f) => f.humanScore !== null && f.matchScoreAtDecision !== null)
    .map((f) => Math.abs((f.humanScore as number) - (f.matchScoreAtDecision as number)));
  const meanScoreGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

  const countBy = (rows: typeof feedback) => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.decision, (counts.get(row.decision) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([decision, count]) => ({ decision, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Which signal codes co-occur with rejection — the empirical basis for reweighting.
  const signalStats = new Map<string, { total: number; rejected: number }>();
  for (const row of feedback) {
    const signals = Array.isArray(row.signalsAtDecision) ? (row.signalsAtDecision as Array<{ code?: string }>) : [];
    const rejected = isNegativeDecision(row.decision);
    for (const signal of signals) {
      if (!signal?.code) continue;
      const stat = signalStats.get(signal.code) ?? { total: 0, rejected: 0 };
      stat.total += 1;
      if (rejected) stat.rejected += 1;
      signalStats.set(signal.code, stat);
    }
  }
  const signalsPredictingRejection = Array.from(signalStats.entries())
    // Require at least 3 occurrences: below that the "rate" is anecdote, not signal.
    .filter(([, stat]) => stat.total >= 3)
    .map(([code, stat]) => ({ code, rejectionRate: stat.rejected / stat.total, occurrences: stat.total }))
    .sort((a, b) => b.rejectionRate - a.rejectionRate);

  return {
    totalDecisions: feedback.length,
    approvals: positives.length,
    rejections: negatives.length,
    approvalPrecision,
    rejectionPrecision,
    falsePositives,
    falseNegatives,
    meanScoreGap,
    topRejectionReasons: countBy(negatives),
    topApprovalReasons: countBy(positives),
    signalsPredictingRejection,
  };
}
