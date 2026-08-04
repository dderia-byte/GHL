import { Search } from "lucide-react";
import { listDiscoveryQueries } from "@/lib/discovery/queries";
import { PageHeader, Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import { QueryForm } from "./query-form";
import { QueryRowControls } from "./query-row-controls";

export const dynamic = "force-dynamic";

export default async function DiscoveryQueriesPage() {
  const queries = await listDiscoveryQueries();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Search queries"
        description="The YouTube searches each discovery run executes. Each page of each query costs 100 of the ~10,000 daily YouTube quota units, so keep this list focused."
      />

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Add a search query</h2>
        <div className="mt-4">
          <QueryForm />
        </div>
      </Card>

      {queries.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No search queries yet"
          description="Add your first query above — for example a niche you want to find creators in."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Search text</th>
                <th className="px-2 py-3 font-medium">Type</th>
                <th className="px-2 py-3 font-medium">Niche keywords</th>
                <th className="px-2 py-3 font-medium">Quota / run</th>
                <th className="px-2 py-3 font-medium">Last run</th>
                <th className="px-2 py-3 font-medium">Results</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {queries.map((query) => (
                <tr key={query.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3 font-medium text-foreground">“{query.queryText}”</td>
                  <td className="px-2 py-3 text-muted-foreground">{query.searchType}</td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    {query.nicheKeywords.length ? query.nicheKeywords.join(", ") : "—"}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{query.maxPages * 100} units</td>
                  <td className="px-2 py-3 text-muted-foreground">
                    {query.lastExecutedAt ? formatRelativeTime(query.lastExecutedAt) : "never"}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{query.lastResultCount ?? "—"}</td>
                  <td className="px-2 py-3">
                    <Badge tone={query.enabled ? "success" : "neutral"}>{query.enabled ? "Enabled" : "Disabled"}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <QueryRowControls queryId={query.id} enabled={query.enabled} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
