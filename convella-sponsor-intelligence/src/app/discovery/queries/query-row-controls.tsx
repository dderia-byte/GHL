"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteQueryAction, toggleQueryAction } from "./actions";

export function QueryRowControls({ queryId, enabled }: { queryId: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleQueryAction(queryId, !enabled);
            setError(result.error);
          })
        }
      >
        {enabled ? "Disable" : "Enable"}
      </Button>
      <Button
        variant="danger"
        disabled={pending}
        aria-label="Delete query"
        onClick={() => {
          if (window.confirm("Delete this search query?")) {
            startTransition(async () => {
              const result = await deleteQueryAction(queryId);
              setError(result.error);
            });
          }
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
