"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { scanLatestVideosAction, reanalyseFailedVideosAction } from "./actions";

export function ChannelActions({ channelId }: { channelId: string }) {
  const [videoCount, setVideoCount] = useState(20);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div>
        <label htmlFor="scan-count" className="block text-xs font-medium text-slate-500">
          Videos to scan
        </label>
        <input
          id="scan-count"
          type="number"
          min={1}
          max={50}
          value={videoCount}
          onChange={(e) => setVideoCount(Number(e.target.value))}
          className="mt-1 w-24 rounded-md border-0 px-2 py-1 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
        />
      </div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            await scanLatestVideosAction(channelId, videoCount, "FIRST_SPONSOR_ONLY");
            setMessage("Scan complete.");
          })
        }
      >
        {isPending ? "Scanning…" : "Scan latest videos"}
      </Button>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            await reanalyseFailedVideosAction(channelId, "FIRST_SPONSOR_ONLY");
            setMessage("Failed videos re-queued.");
          })
        }
      >
        {isPending ? "Working…" : "Reanalyse failed videos"}
      </Button>
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
    </div>
  );
}
