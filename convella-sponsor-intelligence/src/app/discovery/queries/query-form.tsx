"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createQueryAction, type QueryActionState } from "./actions";

const INPUT_CLASSES =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function QueryForm() {
  const [state, formAction, pending] = useActionState<QueryActionState | undefined, FormData>(
    createQueryAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
        YouTube search text
        <input
          name="queryText"
          required
          maxLength={200}
          placeholder="e.g. AI coding tools review"
          className={INPUT_CLASSES}
        />
        <span className="text-xs font-normal text-muted-foreground">
          Exactly what you would type into the YouTube search bar. This is also how the query is labelled everywhere
          else in the app.
        </span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Search type
        <select name="searchType" defaultValue="video" className={INPUT_CLASSES}>
          <option value="video">Videos (finds active creators via their videos)</option>
          <option value="channel">Channels</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Niche keywords <span className="font-normal text-muted-foreground">(comma-separated, optional)</span>
        <input name="nicheKeywords" placeholder="e.g. coding, developer, programming" className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Region <span className="font-normal text-muted-foreground">(optional, e.g. US)</span>
        <input name="regionCode" maxLength={2} placeholder="US" className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Language <span className="font-normal text-muted-foreground">(optional, e.g. en)</span>
        <input name="relevanceLanguage" maxLength={5} placeholder="en" className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Only content published within <span className="font-normal text-muted-foreground">(days, optional)</span>
        <input name="publishedWithinDays" type="number" min={1} max={3650} placeholder="90" className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Pages per run <span className="font-normal text-muted-foreground">(each page costs 100 quota units)</span>
        <input name="maxPages" type="number" min={1} max={5} defaultValue={1} className={INPUT_CLASSES} />
      </label>

      <div className="sm:col-span-2 flex items-center justify-between gap-4">
        {state?.error ? <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p> : <span />}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add search query"}
        </Button>
      </div>
    </form>
  );
}
