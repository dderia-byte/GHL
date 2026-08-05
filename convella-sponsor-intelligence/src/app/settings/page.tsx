import { getEnv, hasAnthropicCredentials, hasGeminiCredentials, hasYouTubeCredentials } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { PageHeader, Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiscoverySettingsForm } from "./discovery-settings-form";

export const dynamic = "force-dynamic";

function ConfiguredBadge({ configured }: { configured: boolean }) {
  return <Badge tone={configured ? "success" : "warning"}>{configured ? "Configured" : "Not configured"}</Badge>;
}

export default async function SettingsPage() {
  const env = getEnv();
  const discoverySettings = {
    dailyCostLimitUsd: await getSetting("budgets.dailyCostLimitUsd"),
    perRunCostLimitUsd: await getSetting("budgets.perRunCostLimitUsd"),
    dailyQuotaUnits: await getSetting("budgets.dailyQuotaUnits"),
    maxCreatorsPerRun: await getSetting("discovery.maxCreatorsPerRun"),
    maxPagesPerQuery: await getSetting("discovery.maxPagesPerQuery"),
    maxSubscribers: await getSetting("discovery.maxSubscribers"),
    maxVideoAgeDays: await getSetting("discovery.maxVideoAgeDays"),
    rejectionCooldownDays: await getSetting("discovery.rejectionCooldownDays"),
  };

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

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Cost-optimised pipeline (v{env.ANALYSIS_PIPELINE_VERSION})</h2>
        <p className="mt-1 text-xs text-slate-500">
          Free deterministic analysis first, then cheap targeted transcript analysis, then expensive native video analysis —
          only as far as each video actually needs.
        </p>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Native video analysis (Stage 3)</dt>
            <dd>
              <Badge tone={env.ENABLE_NATIVE_VIDEO_ANALYSIS ? "success" : "neutral"}>
                {env.ENABLE_NATIVE_VIDEO_ANALYSIS ? "Enabled" : "Disabled"}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Cheap text model (Stage 2)</dt>
            <dd className="font-medium text-slate-800">{env.CHEAP_TEXT_MODEL || `${env.ANTHROPIC_MODEL} (default)`}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Reasoning model</dt>
            <dd className="font-medium text-slate-800">{env.REASONING_MODEL || `${env.ANTHROPIC_MODEL} (default)`}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Max estimated cost per video</dt>
            <dd className="font-medium text-slate-800">${env.MAX_ESTIMATED_COST_PER_VIDEO_USD.toFixed(2)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Max native video calls / seconds per video</dt>
            <dd className="font-medium text-slate-800">
              {env.MAX_NATIVE_VIDEO_CALLS_PER_VIDEO} calls / {env.MAX_NATIVE_VIDEO_SECONDS_PER_VIDEO}s
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Video window length / max windows</dt>
            <dd className="font-medium text-slate-800">
              {env.VIDEO_WINDOW_SECONDS}s / {env.MAX_VIDEO_WINDOWS}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Transcript windows / context / char cap</dt>
            <dd className="font-medium text-slate-800">
              {env.MAX_TRANSCRIPT_WINDOWS} windows, -{env.TRANSCRIPT_CONTEXT_BEFORE_SECONDS}s/+{env.TRANSCRIPT_CONTEXT_AFTER_SECONDS}s, {env.MAX_TRANSCRIPT_MODEL_CHARS.toLocaleString()} chars
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Set via environment variables — see .env.example. When the cost limit would be exceeded before a sponsor is
          confirmed, the video is marked &quot;Human review required&quot; instead of making the request.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Discovery limits &amp; budgets</h2>
        <p className="mt-1 text-xs text-slate-500">
          Operator-editable at runtime (stored in the database, no redeploy needed). Changes apply from the NEXT
          discovery run — a run in progress keeps the limits it started with.
        </p>
        <div className="mt-4">
          <DiscoverySettingsForm values={discoverySettings} />
        </div>
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
