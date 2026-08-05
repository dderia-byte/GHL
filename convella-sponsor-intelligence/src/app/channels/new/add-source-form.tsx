"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addSourceAction, type AddSourceState } from "./actions";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add and start analysis"}
    </Button>
  );
}

const initialState: AddSourceState = {};

export function AddSourceForm() {
  const [state, formAction] = useActionState(addSourceAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor="input" className="block text-sm font-medium text-slate-700">
          YouTube channel URL, handle, channel ID, or video URL
        </label>
        <input
          id="input"
          name="input"
          required
          placeholder="https://www.youtube.com/@channelname or https://www.youtube.com/watch?v=..."
          className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="videoCount" className="block text-sm font-medium text-slate-700">
            Number of recent videos
          </label>
          <input
            id="videoCount"
            name="videoCount"
            type="number"
            min={1}
            max={50}
            defaultValue={20}
            className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
          />
          <p className="mt-1 text-xs text-slate-400">Ignored for a single video URL. Maximum 50.</p>
        </div>

        <div>
          <label htmlFor="analysisMode" className="block text-sm font-medium text-slate-700">
            Analysis mode
          </label>
          <select
            id="analysisMode"
            name="analysisMode"
            defaultValue="FIRST_SPONSOR_ONLY"
            className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
          >
            <option value="FIRST_SPONSOR_ONLY">First sponsor only (default)</option>
            <option value="ALL_SPONSORS">All sponsors</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-700">
            Creator category (optional)
          </label>
          <input
            id="category"
            name="category"
            placeholder="e.g. Software Development"
            className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
          />
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
            Notes (optional)
          </label>
          <input
            id="notes"
            name="notes"
            placeholder="Internal notes for the Convella team"
            className="mt-1 block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
        <input
          id="mediaPermissionAcknowledged"
          name="mediaPermissionAcknowledged"
          type="checkbox"
          value="true"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
        />
        <label htmlFor="mediaPermissionAcknowledged" className="text-sm text-slate-600">
          I confirm Convella is only analysing YouTube metadata, descriptions, and transcripts it is authorised to
          process, and any additional media supplied for deeper analysis is media I own or have permission to
          analyse.
        </label>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {state.error}
        </p>
      ) : null}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
