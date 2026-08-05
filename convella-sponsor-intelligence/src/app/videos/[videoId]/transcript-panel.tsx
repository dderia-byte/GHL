"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { submitPastedTranscriptAction, submitUploadedTranscriptAction, type FormActionState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function TranscriptPanel({ videoId }: { videoId: string }) {
  const [pasteState, pasteAction] = useActionState<FormActionState | undefined, FormData>(
    submitPastedTranscriptAction,
    undefined,
  );
  const [uploadState, uploadAction] = useActionState<FormActionState | undefined, FormData>(
    submitUploadedTranscriptAction,
    undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={pasteAction} className="flex flex-col gap-2">
        <input type="hidden" name="videoId" value={videoId} />
        <label className="text-xs font-medium text-slate-500">Paste a transcript</label>
        <textarea
          name="text"
          rows={4}
          placeholder="Paste transcript text (with or without timestamps)"
          className="rounded-md border-0 px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400"
        />
        {pasteState?.error && <p className="text-xs text-rose-600">{pasteState.error}</p>}
        {pasteState?.success && <p className="text-xs text-emerald-600">Transcript saved.</p>}
        <div>
          <SubmitButton label="Save pasted transcript" pendingLabel="Saving…" />
        </div>
      </form>

      <form action={uploadAction} className="flex flex-col gap-2">
        <input type="hidden" name="videoId" value={videoId} />
        <label className="text-xs font-medium text-slate-500">Or upload a .srt / .vtt / .txt file</label>
        <input
          type="file"
          name="file"
          accept=".srt,.vtt,.txt"
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {uploadState?.error && <p className="text-xs text-rose-600">{uploadState.error}</p>}
        {uploadState?.success && <p className="text-xs text-emerald-600">Transcript uploaded.</p>}
        <div>
          <SubmitButton label="Upload transcript" pendingLabel="Uploading…" />
        </div>
      </form>
      <p className="text-xs text-slate-400">
        Only upload or paste a transcript for media you are authorised to process. The official YouTube captions API
        cannot be assumed to provide transcripts for arbitrary public videos, so this modular system lets you supply
        one directly when needed.
      </p>
    </div>
  );
}
