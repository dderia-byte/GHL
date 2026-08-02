import type { RejectionReason } from "@/generated/prisma/enums";
import type { YouTubeChannelResource } from "@/lib/youtube/types";
import type { DiscoverySettingsSnapshot } from "@/lib/settings/definitions";

export interface NicheDecision {
  method: "topic" | "keyword" | "query-implicit" | "none-configured";
  matched: string[];
  passed: boolean;
}

export interface FilterOutcome {
  passed: boolean;
  rejectionReason: RejectionReason | null;
  /** Human-readable detail persisted to the audit log. */
  detail: string;
  nicheDecision: NicheDecision | null;
}

export interface NicheConfig {
  nicheKeywords: string[];
  nicheTopicIds: string[];
}

/**
 * Niche filter (spec §5.4): topic-category match OR keyword match against channel
 * title/description. A query with no niche configuration passes everything —
 * the query text itself already constrained the results ("query-implicit").
 * Every decision records its method + matches so false rejections are auditable.
 */
export function evaluateNiche(channel: YouTubeChannelResource, config: NicheConfig): NicheDecision {
  if (config.nicheTopicIds.length === 0 && config.nicheKeywords.length === 0) {
    return { method: "none-configured", matched: [], passed: true };
  }

  const topicMatches = channel.topicCategories.filter((topic) =>
    config.nicheTopicIds.some((wanted) => topic.toLowerCase().includes(wanted.toLowerCase())),
  );
  if (topicMatches.length > 0) {
    return { method: "topic", matched: topicMatches, passed: true };
  }

  const haystack = `${channel.title}\n${channel.description}`.toLowerCase();
  const keywordMatches = config.nicheKeywords.filter((keyword) => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return false;
    const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return pattern.test(haystack);
  });
  if (keywordMatches.length > 0) {
    return { method: "keyword", matched: keywordMatches, passed: true };
  }

  return { method: config.nicheTopicIds.length ? "topic" : "keyword", matched: [], passed: false };
}

/**
 * Cheapest-first candidate filtering (spec §5.2 step 3): subscriber cap → niche.
 * Both checks are free (metadata already hydrated in one batched call); the first
 * failure wins so the recorded rejection reason is the cheapest one that applied.
 * The activity filter runs later (evaluateActivity), during qualification — it
 * needs an uploads-playlist call, which is only worth spending on candidates that
 * survived the free filters AND made the per-run cap.
 */
export function evaluateFilters(options: {
  channel: YouTubeChannelResource;
  niche: NicheConfig;
  settings: Pick<DiscoverySettingsSnapshot, "maxSubscribers" | "allowHiddenSubscriberCounts">;
}): FilterOutcome {
  const { channel, settings } = options;

  if (channel.hiddenSubscriberCount && !settings.allowHiddenSubscriberCounts) {
    return {
      passed: false,
      rejectionReason: "SUBSCRIBERS_HIDDEN",
      detail: "Channel hides its subscriber count, so the size cap cannot be verified.",
      nicheDecision: null,
    };
  }

  if (channel.subscriberCount !== null && channel.subscriberCount > settings.maxSubscribers) {
    return {
      passed: false,
      rejectionReason: "SUBSCRIBERS_OVER_CAP",
      detail: `${channel.subscriberCount.toLocaleString()} subscribers exceeds the ${settings.maxSubscribers.toLocaleString()} cap.`,
      nicheDecision: null,
    };
  }

  const nicheDecision = evaluateNiche(channel, options.niche);
  if (!nicheDecision.passed) {
    return {
      passed: false,
      rejectionReason: "NICHE_MISMATCH",
      detail: `No topic or keyword match for the query's niche configuration (method: ${nicheDecision.method}).`,
      nicheDecision,
    };
  }

  return { passed: true, rejectionReason: null, detail: "Passed subscriber and niche filters.", nicheDecision };
}

/** Activity filter, applied at qualification start once the uploads list is known. */
export function evaluateActivity(
  newestUploadAt: Date | null,
  settings: Pick<DiscoverySettingsSnapshot, "maxVideoAgeDays">,
  now: Date = new Date(),
): { passed: boolean; detail: string } {
  if (newestUploadAt === null) {
    return { passed: false, detail: "No uploads found for this channel." };
  }
  const ageDays = (now.getTime() - newestUploadAt.getTime()) / (24 * 3600 * 1000);
  if (ageDays > settings.maxVideoAgeDays) {
    return {
      passed: false,
      detail: `Newest upload is ${Math.floor(ageDays)} days old (limit ${settings.maxVideoAgeDays}).`,
    };
  }
  return { passed: true, detail: "Channel is actively uploading." };
}
