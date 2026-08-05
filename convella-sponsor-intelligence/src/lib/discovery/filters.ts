import type { RejectionReason } from "@/generated/prisma/enums";
import type { YouTubeChannelResource } from "@/lib/youtube/types";
import type { DiscoverySettingsSnapshot } from "@/lib/settings/definitions";

export interface FilterOutcome {
  passed: boolean;
  rejectionReason: RejectionReason | null;
  /** Human-readable detail persisted to the audit log. */
  detail: string;
}

/**
 * Cheapest-first candidate filtering (spec §5.2 step 3): the subscriber cap is the
 * only free metadata filter — the YouTube search text itself is what defines the
 * niche, so nothing is rejected for being "off-niche". (A separate keyword filter
 * used to run here; it silently dropped relevant creators whose title/description
 * happened not to repeat the keyword, which is exactly the manual-work problem this
 * system exists to remove.)
 * The activity filter runs later (evaluateActivity), during qualification — it
 * needs an uploads-playlist call, which is only worth spending on candidates that
 * survived the free filters AND made the per-run cap.
 */
export function evaluateFilters(options: {
  channel: YouTubeChannelResource;
  settings: Pick<DiscoverySettingsSnapshot, "maxSubscribers" | "allowHiddenSubscriberCounts">;
}): FilterOutcome {
  const { channel, settings } = options;

  if (channel.hiddenSubscriberCount && !settings.allowHiddenSubscriberCounts) {
    return {
      passed: false,
      rejectionReason: "SUBSCRIBERS_HIDDEN",
      detail: "Channel hides its subscriber count, so the size cap cannot be verified.",
    };
  }

  if (channel.subscriberCount !== null && channel.subscriberCount > settings.maxSubscribers) {
    return {
      passed: false,
      rejectionReason: "SUBSCRIBERS_OVER_CAP",
      detail: `${channel.subscriberCount.toLocaleString()} subscribers exceeds the ${settings.maxSubscribers.toLocaleString()} cap.`,
    };
  }

  return { passed: true, rejectionReason: null, detail: "Passed the subscriber filter." };
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
