"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { refreshBrandIntelligenceAction } from "./actions";

export function RefreshIntelligenceButton({ brandId }: { brandId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={isPending}
      onClick={() => startTransition(() => refreshBrandIntelligenceAction(brandId))}
    >
      {isPending ? "Refreshing…" : "Refresh competitor & creator suggestions"}
    </Button>
  );
}
