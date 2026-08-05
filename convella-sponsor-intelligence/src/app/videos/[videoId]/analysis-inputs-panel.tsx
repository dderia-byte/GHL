import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalysisInputsUsed } from "@/lib/video-analysis/types";

function YesNo({ value }: { value: boolean }) {
  return <Badge tone={value ? "success" : "neutral"}>{value ? "Yes" : "No"}</Badge>;
}

const MEDIA_SOURCE_LABELS: Record<AnalysisInputsUsed["mediaSourceMethod"], string> = {
  YOUTUBE_URL: "Public YouTube URL (native video input)",
  GEMINI_FILE: "Operator-uploaded file (Gemini Files API)",
  LOCAL_UPLOAD: "Operator-uploaded file (local)",
  NONE: "None — text only",
};

/**
 * Shows exactly what was actually analysed for this video's most recent run, so a
 * reviewer never mistakes text-only analysis for real video/audio inspection.
 * `analysisInputs` is null before the video has ever been analysed.
 */
export function AnalysisInputsPanel({ analysisInputs }: { analysisInputs: AnalysisInputsUsed | null }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Inputs actually analysed</h2>
      {!analysisInputs ? (
        <p className="mt-3 text-sm text-slate-500">Not analysed yet.</p>
      ) : (
        <>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Public YouTube video</dt>
              <dd>
                <YesNo value={analysisInputs.videoInputAnalysed} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Native audio</dt>
              <dd>
                <YesNo value={analysisInputs.nativeAudioAnalysed} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Visual frames</dt>
              <dd>
                <YesNo value={analysisInputs.visualFramesAnalysed} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Transcript</dt>
              <dd>
                <YesNo value={analysisInputs.transcriptProvided} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Description</dt>
              <dd>
                <YesNo value={analysisInputs.descriptionProvided} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Gemini model</dt>
              <dd className="text-right font-medium text-slate-700">{analysisInputs.model || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Media source method</dt>
              <dd className="text-right font-medium text-slate-700">{MEDIA_SOURCE_LABELS[analysisInputs.mediaSourceMethod]}</dd>
            </div>
          </dl>
          {analysisInputs.providerError && (
            <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
              {analysisInputs.providerError}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
