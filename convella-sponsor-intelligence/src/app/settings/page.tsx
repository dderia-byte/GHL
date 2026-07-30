import { getEnv, hasAnthropicCredentials, hasGeminiCredentials, hasYouTubeCredentials } from "@/lib/env";
import { PageHeader, Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function ConfiguredBadge({ configured }: { configured: boolean }) {
  return <Badge tone={configured ? "success" : "warning"}>{configured ? "Configured" : "Not configured"}</Badge>;
}

export default function SettingsPage() {
  const env = getEnv();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Provider configuration and defaults. These are set via environment variables — see .env.example."
      />

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Provider configuration</h2>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">YouTube Data API</dt>
            <dd>
              <ConfiguredBadge configured={hasYouTubeCredentials()} />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Anthropic reasoning ({env.ANTHROPIC_MODEL})</dt>
            <dd>
              <ConfiguredBadge configured={hasAnthropicCredentials()} />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Gemini video analysis ({env.GEMINI_VIDEO_MODEL})</dt>
            <dd>
              <ConfiguredBadge configured={hasGeminiCredentials()} />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          When Gemini or Anthropic credentials are not configured, the mock provider is used automatically so the
          application remains fully usable for development, demos, and testing.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Analysis defaults</h2>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Default analysis mode</dt>
            <dd className="font-medium text-slate-800">{env.DEFAULT_ANALYSIS_MODE.replaceAll("_", " ")}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Default chunk length</dt>
            <dd className="font-medium text-slate-800">{env.DEFAULT_CHUNK_SECONDS} seconds (30s for videos under 10 minutes)</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Transcript provider</dt>
            <dd className="font-medium text-slate-800">{env.TRANSCRIPT_PROVIDER}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Max upload size</dt>
            <dd className="font-medium text-slate-800">{env.MAX_UPLOAD_SIZE_MB} MB</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          The analysis mode (First sponsor only / All sponsors) can also be chosen per channel or video when adding
          it — the default above only applies when not overridden.
        </p>
      </Card>

      <Card className="bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-900">Compliance reminder</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Only process video or audio you have the legal right or permission to analyse.</li>
          <li>AI-assisted sponsor detections always require human review before being treated as confirmed.</li>
          <li>Competitor suggestions are AI-generated research suggestions, not verified facts.</li>
        </ul>
      </Card>
    </div>
  );
}
