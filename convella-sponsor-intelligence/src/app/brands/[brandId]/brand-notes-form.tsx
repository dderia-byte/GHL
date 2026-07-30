"use client";

import { useActionState } from "react";
import { updateBrandNotesAction } from "./actions";
import { Button } from "@/components/ui/button";

async function action(_prevState: void, formData: FormData) {
  await updateBrandNotesAction(formData);
}

export function BrandNotesForm({ brandId, notes }: { brandId: string; notes: string }) {
  const [, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="brandId" value={brandId} />
      <textarea
        name="notes"
        defaultValue={notes}
        rows={4}
        placeholder="Internal notes about this brand for the Convella team"
        className="block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
      />
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </form>
  );
}
