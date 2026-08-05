"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge, Badge } from "@/components/ui/badge";
import {
  confirmDetectionAction,
  rejectDetectionAction,
  markOrganicAction,
  markAffiliateOnlyAction,
} from "@/app/videos/[videoId]/actions";

export interface ReviewQueueItem {
  id: string;
  videoId: string;
  videoTitle: string;
  channelName: string;
  brandName: string;
  confidenceScore: number;
  placementType: string;
  evidenceText: string;
  publishedAt: string | null;
  viewCount: number | null;
}

export function ReviewQueueList({ items }: { items: ReviewQueueItem[] }) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = items.filter((i) => !skipped.has(i.id));

  if (visible.length === 0) {
    return <p className="text-sm text-slate-500">Nothing left in the queue right now.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100">
      {visible.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link href={`/videos/${item.videoId}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                {item.videoTitle}
              </Link>
              <p className="text-xs text-slate-500">
                {item.channelName} · {item.brandName} · {item.placementType.replaceAll("_", " ")}
              </p>
            </div>
            <ConfidenceBadge score={item.confidenceScore} />
          </div>
          <p className="text-sm text-slate-600">{item.evidenceText}</p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            {item.publishedAt && <Badge>{new Date(item.publishedAt).toLocaleDateString()}</Badge>}
            {item.viewCount !== null && <Badge>{item.viewCount.toLocaleString()} views</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => startTransition(() => confirmDetectionAction(item.id, item.videoId))}
            >
              Confirm
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => startTransition(() => rejectDetectionAction(item.id, item.videoId))}
            >
              Reject
            </Button>
            <Link
              href={`/videos/${item.videoId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Edit
            </Link>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => startTransition(() => markOrganicAction(item.id, item.videoId))}
            >
              Organic
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => startTransition(() => markAffiliateOnlyAction(item.id, item.videoId))}
            >
              Affiliate only
            </Button>
            <Button variant="ghost" onClick={() => setSkipped((s) => new Set(s).add(item.id))}>
              Skip
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
