"use client";

import { useState, useTransition } from "react";
import { Play, Pause, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelRunAction,
  pauseRunAction,
  resumeRunAction,
  startDiscoveryRunAction,
} from "./actions";

export function StartRunButton({ disabled, disabledReason }: { disabled: boolean; disabledReason?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        disabled={disabled || pending}
        title={disabled ? disabledReason : undefined}
        onClick={() =>
          startTransition(async () => {
            const result = await startDiscoveryRunAction();
            setError(result.error);
          })
        }
      >
        <Play className="size-4" />
        {pending ? "Starting…" : "Run Discovery"}
      </Button>
      {disabled && disabledReason ? <p className="text-xs text-muted-foreground">{disabledReason}</p> : null}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}

export function RunLifecycleControls({
  runId,
  status,
}: {
  runId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const act = (fn: (id: string) => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn(runId);
      setError(result.error);
    });

  const canPause = status === "RUNNING" || status === "QUEUED";
  const canResume = status === "PAUSED" || status.startsWith("HALTED");
  const canCancel = !["COMPLETED", "CANCELLED", "FAILED"].includes(status);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {canPause && (
          <Button variant="secondary" disabled={pending} onClick={() => act(pauseRunAction)}>
            <Pause className="size-4" /> Pause
          </Button>
        )}
        {canResume && (
          <Button variant="secondary" disabled={pending} onClick={() => act(resumeRunAction)}>
            <RotateCcw className="size-4" /> Resume
          </Button>
        )}
        {canCancel && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Cancel this discovery run? Completed analyses are kept.")) {
                act(cancelRunAction);
              }
            }}
          >
            <XCircle className="size-4" /> Cancel
          </Button>
        )}
      </div>
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}
