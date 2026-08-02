import Link from "next/link";
import { Users } from "lucide-react";
import { listDiscoveredCreators, type CreatorTab } from "@/lib/discovery/queries";
import { PageHeader, Card, EmptyState } from "@/components/ui/card";
import { CandidateStateBadge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS: { key: CreatorTab; label: string }[] = [
  { key: "qualified", label: "Qualified" },
  { key: "borderline", label: "Borderline" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default async function DiscoveredCreatorsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await props.searchParams;
  const tab: CreatorTab = TABS.some((t) => t.key === rawTab) ? (rawTab as CreatorTab) : "qualified";
  const creators = await listDiscoveredCreators(tab);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Discovered creators"
        description="Creators the discovery engine has found, qualified, or rejected — every decision recorded."
      />

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/discovery/creators?tab=${t.key}`}
            className={`border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {creators.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`No ${tab === "all" ? "" : tab + " "}creators yet`}
          description="Run Discovery to start filling this list."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Creator</th>
                <th className="px-2 py-3 font-medium">Subscribers</th>
                <th className="px-2 py-3 font-medium">State</th>
                <th className="px-2 py-3 font-medium">Reason</th>
                <th className="px-2 py-3 font-medium">Sponsors found</th>
                <th className="px-2 py-3 font-medium">Source query</th>
                <th className="px-2 py-3 font-medium">Cost</th>
                <th className="px-5 py-3 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {creators.map((creator) => (
                <tr key={creator.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    {creator.channel ? (
                      <Link
                        href={`/channels/${creator.channel.id}`}
                        className="font-medium text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {creator.channel.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{creator.channelTitle ?? creator.youtubeChannelId}</span>
                    )}
                    {creator.borderline && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-900/40">
                        borderline
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">
                    {creator.subscriberCountAtDiscovery !== null
                      ? Number(creator.subscriberCountAtDiscovery).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <CandidateStateBadge state={creator.state} />
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    {creator.rejectionReason?.replaceAll("_", " ") ?? "—"}
                  </td>
                  <td className="px-2 py-3">
                    {creator.sponsorBrands.length ? (
                      <div className="flex flex-wrap gap-1">
                        {creator.sponsorBrands.slice(0, 3).map((brand) => (
                          <span
                            key={brand}
                            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-900/40"
                          >
                            {brand}
                          </span>
                        ))}
                        {creator.sponsorBrands.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">+{creator.sponsorBrands.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">{creator.query?.label ?? "—"}</td>
                  <td className="px-2 py-3 text-muted-foreground">${creator.estimatedCostNumber.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                    {formatRelativeTime(creator.updatedAt)}
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
