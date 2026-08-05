import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrandDetails } from "@/lib/brands/queries";
import { PageHeader, Card } from "@/components/ui/card";
import { ConfidenceBadge, ReviewStatusBadge, Badge } from "@/components/ui/badge";
import { buildTimestampedVideoUrl } from "@/lib/youtube/parse";
import { BrandNotesForm } from "./brand-notes-form";
import { RefreshIntelligenceButton } from "./refresh-button";

export const dynamic = "force-dynamic";

export default async function BrandDetailsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await getBrandDetails(brandId);
  if (!brand) notFound();

  const creators = new Set(brand.sponsorshipDetections.map((d) => d.video.channel.id));
  const placementTypes = Array.from(new Set(brand.sponsorshipDetections.map((d) => d.placementType)));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={brand.displayName}
        description={brand.domain ? `${brand.domain}${brand.category ? ` · ${brand.category}` : ""}` : brand.category ?? undefined}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/api/export/brand/${brand.id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Export CSV
            </Link>
            <RefreshIntelligenceButton brandId={brand.id} />
          </div>
        }
      />

      {brand.aliases.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {brand.aliases.map((alias) => (
            <Badge key={alias}>{alias}</Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Sponsorship history</h2>
            {brand.sponsorshipDetections.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No detections recorded yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-slate-100">
                {brand.sponsorshipDetections.map((detection) => (
                  <li key={detection.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/videos/${detection.video.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                        {detection.video.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <ConfidenceBadge score={detection.confidenceScore} />
                        <ReviewStatusBadge status={detection.reviewStatus} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {detection.video.channel.name}
                      {detection.video.publishedAt && <> · {new Date(detection.video.publishedAt).toLocaleDateString()}</>}
                      {" · "}
                      {detection.placementType.replaceAll("_", " ")}
                      {detection.startTimestampSeconds !== null && (
                        <>
                          {" · "}
                          <a
                            href={buildTimestampedVideoUrl(detection.video.youtubeVideoId, detection.startTimestampSeconds)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-500"
                          >
                            {detection.startTimestampSeconds}s
                          </a>
                        </>
                      )}
                      {detection.promotionalUrl && <> · {detection.promotionalUrl}</>}
                      {detection.discountCode && <> · Code: {detection.discountCode}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Suggested competitors</h2>
            <p className="mt-1 text-xs text-amber-700">AI-generated suggestions — not verified facts.</p>
            {brand.competitorSuggestions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No competitor suggestions yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-slate-100">
                {brand.competitorSuggestions.map((c) => (
                  <li key={c.id} className="py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {c.suggestedBrandName} {c.suggestedDomain && <span className="text-slate-400">({c.suggestedDomain})</span>}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{c.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Associated creators</dt>
                <dd className="font-medium text-slate-700">{creators.size}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Placement types</dt>
                <dd className="text-right font-medium text-slate-700">{placementTypes.join(", ") || "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Suggested similar creators</h2>
            <p className="mt-1 text-xs text-slate-400">Rule-based opportunity scoring, not embeddings.</p>
            {brand.creatorOpportunities.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No suggestions yet — try refreshing.</p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-slate-100">
                {brand.creatorOpportunities.map((op) => (
                  <li key={op.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <Link href={`/channels/${op.channel.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                        {op.channel.name}
                      </Link>
                      <Badge tone="info">{op.opportunityScore}/100</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{op.reason}</p>
                    {op.conflictWarning && <p className="mt-1 text-xs text-rose-600">{op.conflictWarning}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
            <div className="mt-3">
              <BrandNotesForm brandId={brand.id} notes={brand.notes ?? ""} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
