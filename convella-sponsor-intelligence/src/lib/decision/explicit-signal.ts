import type { SponsorEvidenceInput } from "../video-analysis/types";

const EXPLICIT_SPOKEN_PATTERNS = [
  /sponsored by/i,
  /sponsor of (today's|this) video/i,
  /today'?s sponsor/i,
  /thanks? to .+ for sponsoring/i,
  /thank you to .+ for sponsoring/i,
  /brought to you by/i,
  /paid partnership/i,
  /this video is sponsored/i,
];

const ON_SCREEN_DISCLOSURE_PATTERNS = [/paid promotion/i, /sponsor(ed)? (card|disclosure|overlay)/i, /includes paid promotion/i];

/** Whether an evidence item's text is an explicit spoken sponsorship statement (audio or transcript). */
export function isExplicitSpokenStatement(evidence: SponsorEvidenceInput): boolean {
  if (evidence.source !== "VIDEO_AUDIO" && evidence.source !== "TRANSCRIPT") return false;
  return EXPLICIT_SPOKEN_PATTERNS.some((pattern) => pattern.test(evidence.text));
}

/** Whether an evidence item documents an on-screen paid-promotion disclosure card/overlay. */
export function isOnScreenDisclosure(evidence: SponsorEvidenceInput): boolean {
  if (evidence.source !== "VIDEO_VISUAL") return false;
  return ON_SCREEN_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(evidence.text));
}
