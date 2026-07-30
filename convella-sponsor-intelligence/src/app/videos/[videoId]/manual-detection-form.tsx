"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { addManualDetectionAction, type FormActionState } from "./actions";

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

export function ManualDetectionForm({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormActionState | undefined, FormData>(addManualDetectionAction, undefined);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add missed sponsor manually
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3">
      <input type="hidden" name="videoId" value={videoId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-500">Brand name</label>
          <input name="brandName" required className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Brand domain (optional)</label>
          <input name="brandDomain" className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">Placement type</label>
        <select name="placementType" className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300">
          {PLACEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-500">Start timestamp (seconds)</label>
          <input name="startTimestampSeconds" type="number" min={0} className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">End timestamp (seconds)</label>
          <input name="endTimestampSeconds" type="number" min={0} className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">Evidence</label>
        <textarea name="evidenceText" required rows={2} className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Promotional URL</label>
          <input name="promotionalUrl" className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Discount code</label>
          <input name="discountCode" className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Call to action</label>
          <input name="callToAction" className="mt-1 w-full rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300" />
        </div>
      </div>
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-600">Sponsor added.</p>}
      <div className="flex gap-2">
        <Button type="submit">Save sponsor</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
