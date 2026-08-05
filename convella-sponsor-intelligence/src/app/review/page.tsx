import { getReviewQueue } from "@/lib/review/queries";
import { PageHeader, Card, EmptyState } from "@/components/ui/card";
import { ReviewQueueList, type ReviewQueueItem } from "./review-queue-list";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const detections = await getReviewQueue();

  const items: ReviewQueueItem[] = detections.map((d) => ({
    id: d.id,
    videoId: d.video.id,
    videoTitle: d.video.title,
    channelName: d.video.channel.name,
    brandName: d.brand?.displayName ?? d.rawBrandName,
    confidenceScore: d.confidenceScore,
    placementType: d.placementType,
    evidenceText: d.evidenceText,
    publishedAt: d.video.publishedAt ? d.video.publishedAt.toISOString() : null,
    viewCount: d.video.viewCount !== null ? Number(d.video.viewCount) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review queue"
        description="Unreviewed detections, ordered by commercial relevance, confidence, recency, and views."
        actions={
          <a
            href="/api/export/all?reviewStatus=PENDING"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Export pending (CSV)
          </a>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Nothing to review" description="All detections have been reviewed." />
      ) : (
        <Card>
          <ReviewQueueList items={items} />
        </Card>
      )}
    </div>
  );
}
