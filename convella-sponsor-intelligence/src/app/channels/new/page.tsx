import { PageHeader, Card } from "@/components/ui/card";
import { AddSourceForm } from "./add-source-form";

export default function AddChannelPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add channel or video"
        description="Enter a YouTube channel URL, handle, channel ID, or an individual video URL to begin sponsor analysis."
      />
      <Card className="max-w-2xl">
        <AddSourceForm />
      </Card>
      <Card className="max-w-2xl bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-900">Before you continue</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Only YouTube channel/video metadata retrieved via the official YouTube Data API is used automatically.</li>
          <li>Only process video or audio you have the legal right or permission to analyse.</li>
          <li>All AI-assisted sponsor detections require human review before they should be treated as confirmed.</li>
        </ul>
      </Card>
    </div>
  );
}
