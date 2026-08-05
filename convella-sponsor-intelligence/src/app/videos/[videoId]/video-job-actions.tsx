"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markNoSponsorAction, reanalyseVideoAction, continueAnalysisAction } from "./actions";

export function VideoJobActions({ videoId, canContinue }: { videoId: string; canContinue: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={isPending} onClick={() => startTransition(() => reanalyseVideoAction(videoId))}>
        Reanalyse video
      </Button>
      {canContinue && (
        <Button variant="secondary" disabled={isPending} onClick={() => startTransition(() => continueAnalysisAction(videoId))}>
          Continue analysis after first sponsor
        </Button>
      )}
      <Button variant="secondary" disabled={isPending} onClick={() => startTransition(() => markNoSponsorAction(videoId))}>
        Mark no sponsor
      </Button>
    </div>
  );
}
