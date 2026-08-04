"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveDiscoverySettingsAction, type SettingsActionState } from "./actions";

const INPUT_CLASSES =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export interface DiscoverySettingsFormValues {
  dailyCostLimitUsd: number;
  perRunCostLimitUsd: number;
  dailyQuotaUnits: number;
  maxCreatorsPerRun: number;
  maxPagesPerQuery: number;
  maxGatingPaidVideos: number;
  deepScanVideoCount: number;
  maxSubscribers: number;
  maxVideoAgeDays: number;
  rejectionCooldownDays: number;
  includePreviouslySeenCreators: boolean;
}

type NumericSettingKey = Exclude<keyof DiscoverySettingsFormValues, "includePreviouslySeenCreators">;

const FIELDS: { name: NumericSettingKey; label: string; hint?: string; step?: string }[] = [
  { name: "dailyCostLimitUsd", label: "Daily cost limit (USD)", hint: "Hard ceiling across ALL runs per UTC day", step: "0.01" },
  { name: "perRunCostLimitUsd", label: "Per-run cost limit (USD)", hint: "A single run halts (resumably) at this spend", step: "0.01" },
  { name: "dailyQuotaUnits", label: "Daily YouTube quota budget (units)", hint: "Each search page costs 100 units" },
  { name: "maxCreatorsPerRun", label: "Max creators per run", hint: "1–100 — raise this to find more creators per run" },
  {
    name: "maxPagesPerQuery",
    label: "Search pages per query",
    hint: "1–10. Each page = up to 50 results (far fewer unique channels) and costs 100 quota units. Raise for more creators.",
  },
  {
    name: "maxGatingPaidVideos",
    label: "Paid videos per qualification attempt",
    hint: "0–5. Videos analysed to qualify a creator when the free description scan finds no outright disclosure. 0 = free-gate only (zero cost).",
  },
  { name: "deepScanVideoCount", label: "Videos scanned per creator", hint: "1–10 — also the size of the free description gate" },
  { name: "maxSubscribers", label: "Subscriber cap", hint: "Channels above this are filtered out" },
  { name: "maxVideoAgeDays", label: "Max age of newest upload (days)", hint: "Older channels are rejected as inactive" },
  { name: "rejectionCooldownDays", label: "Rejection cooldown (days)", hint: "Rejected channels can be re-discovered after this" },
];

export function DiscoverySettingsForm({ values }: { values: DiscoverySettingsFormValues }) {
  const [state, formAction, pending] = useActionState<SettingsActionState | undefined, FormData>(
    saveDiscoverySettingsAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          {field.label}
          <input
            name={field.name}
            type="number"
            step={field.step ?? "1"}
            min={0}
            defaultValue={values[field.name]}
            className={INPUT_CLASSES}
          />
          {field.hint && <span className="text-xs font-normal text-muted-foreground">{field.hint}</span>}
        </label>
      ))}
      <label className="sm:col-span-2 flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <input
          type="checkbox"
          name="includePreviouslySeenCreators"
          defaultChecked={values.includePreviouslySeenCreators}
          className="mt-0.5 size-4 rounded border-border"
        />
        <span>
          <span className="font-medium text-foreground">Include previously-seen creators</span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            Analyse creators already in the database or rejected by an earlier run instead of skipping them. They are
            tagged <strong>Duplicate = Yes</strong> in the CSV so you can filter them by hand and never miss anyone.
            Costs money: previously-rejected videos are analysed again.
          </span>
        </span>
      </label>

      <div className="sm:col-span-2 flex items-center justify-between gap-4">
        {state?.error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
        ) : state?.success ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved — applies to the next run.</p>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save discovery settings"}
        </Button>
      </div>
    </form>
  );
}
