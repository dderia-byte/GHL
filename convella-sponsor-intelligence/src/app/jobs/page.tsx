import Link from "next/link";
import { listAnalysisJobs } from "@/lib/jobs/list-queries";
import { PageHeader, Card, EmptyState } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString() : "—";
}

export default async function AnalysisJobsPage() {
  const jobs = await listAnalysisJobs();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analysis jobs" description="Background job history for channel scans and video analyses." />

      {jobs.length === 0 ? (
        <EmptyState title="No jobs yet" description="Jobs appear here once you add a channel or video." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Channel / video</th>
                <th className="px-4 py-3">Chunk</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Seconds analysed</th>
                <th className="px-4 py-3">Chunks</th>
                <th className="px-4 py-3">Est. cost</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{job.jobType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {job.video ? (
                      <Link href={`/videos/${job.video.id}`} className="text-indigo-600 hover:text-indigo-500">
                        {job.video.title}
                      </Link>
                    ) : job.channel ? (
                      <Link href={`/channels/${job.channel.id}`} className="text-indigo-600 hover:text-indigo-500">
                        {job.channel.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {job.currentChunkStart !== null ? `${job.currentChunkStart}s–${job.currentChunkEnd}s` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{Math.round(job.progress * 100)}%</td>
                  <td className="px-4 py-3 text-slate-500">{job.secondsAnalysed}</td>
                  <td className="px-4 py-3 text-slate-500">{job.chunksProcessed}</td>
                  <td className="px-4 py-3 text-slate-500">${job.estimatedCost.toFixed(4)}</td>
                  <td className="px-4 py-3 text-slate-500">{job.attempts}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(job.startedAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(job.completedAt)}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-rose-600">{job.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
