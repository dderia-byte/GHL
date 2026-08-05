import Link from "next/link";
import { listBrandsWithStats } from "@/lib/brands/queries";
import { PageHeader, Card, EmptyState } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await listBrandsWithStats();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Brands" description="Every brand discovered across monitored channels." />

      {brands.length === 0 ? (
        <EmptyState title="No brands yet" description="Brands appear here once sponsor detections are created." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Placements</th>
                <th className="px-4 py-3">Confirmed</th>
                <th className="px-4 py-3">Creators</th>
                <th className="px-4 py-3">Avg. confidence</th>
                <th className="px-4 py-3">Review status</th>
                <th className="px-4 py-3">Last detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brands.map((row) => (
                <tr key={row.brand.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/brands/${row.brand.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {row.brand.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.brand.domain ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{row.brand.category ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{row.placementsDetected}</td>
                  <td className="px-4 py-3 text-slate-500">{row.placementsConfirmed}</td>
                  <td className="px-4 py-3 text-slate-500">{row.associatedCreators}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.averageConfidence !== null ? `${Math.round(row.averageConfidence * 100)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.reviewStatus}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.mostRecentDetectionAt ? new Date(row.mostRecentDetectionAt).toLocaleDateString() : "—"}
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
