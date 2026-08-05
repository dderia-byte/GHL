"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge, ReviewStatusBadge, Badge } from "@/components/ui/badge";
import { buildTimestampedVideoUrl } from "@/lib/youtube/parse";
import { describeEvidenceSource } from "@/lib/video-analysis/evidence-labels";
import type { ChunkEvidenceSource } from "@/lib/video-analysis/types";
import {
  confirmDetectionAction,
  rejectDetectionAction,
  markOrganicAction,
  markAffiliateOnlyAction,
  editDetectionAction,
  type FormActionState,
} from "./actions";

const PLACEMENT_TYPES = [
  "DEDICATED_VIDEO",
  "SPONSORED_INTEGRATION",
  "PRODUCT_PLACEMENT",
  "AFFILIATE_PROMOTION",
  "FREE_PRODUCT_OR_GIFTED",
  "ORGANIC_MENTION",
  "CHANNEL_PARTNERSHIP",
  "UNKNOWN",
];

export interface DetectionCardData {
  id: string;
  rawBrandName: string;
  brandDisplayName: string | null;
  brandDomain: string | null;
  placementType: string;
  startTimestampSeconds: number | null;
  endTimestampSeconds: number | null;
  evidenceText: string;
  confidenceScore: number;
  reasoningSummary: string;
  promotionalUrl: string | null;
  discountCode: string | null;
  callToAction: string | null;
  reviewStatus: string;
  sponsorshipConfirmed: boolean;
  evidence: Array<{ id: string; source: string; timestampSeconds: number | null; text: string; strength: number }>;
}

export function DetectionCard({ detection, videoId, youtubeVideoId }: { detection: DetectionCardData; videoId: string; youtubeVideoId: string }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editState, editFormAction] = useActionState<FormActionState | undefined, FormData>(editDetectionAction, undefined);

  const lowConfidenceWarning = detection.confidenceScore < 0.75;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{detection.brandDisplayName ?? detection.rawBrandName}</p>
          <p className="text-xs text-slate-500">
            {detection.placementType.replaceAll("_", " ")}
            {detection.brandDomain ? ` · ${detection.brandDomain}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge score={detection.confidenceScore} />
          <ReviewStatusBadge status={detection.reviewStatus} />
        </div>
      </div>

      {lowConfidenceWarning && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          Below 0.75 confidence — treat as unconfirmed and review carefully before acting on it.
        </p>
      )}

      <p className="mt-3 text-sm text-slate-700">{detection.evidenceText}</p>
      <p className="mt-2 text-xs text-slate-500">{detection.reasoningSummary}</p>

      {detection.startTimestampSeconds !== null && (
        <a
          href={buildTimestampedVideoUrl(youtubeVideoId, detection.startTimestampSeconds)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500"
        >
          Watch at {detection.startTimestampSeconds}s →
        </a>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {detection.promotionalUrl && <Badge tone="info">{detection.promotionalUrl}</Badge>}
        {detection.discountCode && <Badge tone="info">Code: {detection.discountCode}</Badge>}
      </div>

      {detection.evidence.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">
            {detection.evidence.length} supporting evidence item(s)
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 pl-3">
            {detection.evidence.map((e) => (
              <li key={e.id} className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">
                  [{describeEvidenceSource(e.source as ChunkEvidenceSource)}
                  {e.timestampSeconds !== null ? ` @${e.timestampSeconds}s` : ""}]
                </span>{" "}
                {e.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={() => startTransition(() => confirmDetectionAction(detection.id, videoId))}
        >
          Confirm sponsor
        </Button>
        <Button
          variant="danger"
          disabled={isPending}
          onClick={() => startTransition(() => rejectDetectionAction(detection.id, videoId))}
        >
          Reject sponsor
        </Button>
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={() => startTransition(() => markOrganicAction(detection.id, videoId))}
        >
          Mark organic mention
        </Button>
        <Button
          variant="secondary"
          disabled={isPending}
          onClick={() => startTransition(() => markAffiliateOnlyAction(detection.id, videoId))}
        >
          Mark affiliate only
        </Button>
        <Button variant="secondary" onClick={() => setIsEditing((v) => !v)}>
          {isEditing ? "Cancel edit" : "Edit sponsor"}
        </Button>
      </div>

      {isEditing && (
        <form action={editFormAction} className="mt-4 flex flex-col gap-3 rounded-md bg-slate-50 p-3">
          <input type="hidden" name="detectionId" value={detection.id} />
          <input type="hidden" name="videoId" value={videoId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-500">Brand name</label>
              <input
                name="rawBrandName"
                defaultValue={detection.rawBrandName}
                className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Placement type</label>
              <select
                name="placementType"
                defaultValue={detection.placementType}
                className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300"
              >
                {PLACEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Evidence text</label>
            <textarea
              name="evidenceText"
              defaultValue={detection.evidenceText}
              rows={2}
              className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300"
            />
          </div>
          {editState?.error && <p className="text-xs text-rose-600">{editState.error}</p>}
          <div>
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
