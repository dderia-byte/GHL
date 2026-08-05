import Link from "next/link";
import { Target } from "lucide-react";
import { listBrandsWithMatches, listMatches } from "@/lib/matching/queries";
import { PageHeader, Card, EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { MatchCard } from "./match-card";

export const dynamic = "force-dynamic";

export default async function MatchesPage(props: { searchParams: Promise<{ brand?: string; minConfidence?: string }> }) {
  const params = await props.searchParams;
  const brands = await listBrandsWithMatches();
  const brandId = params.brand && brands.some((b) => b.id === params.brand) ? params.brand : brands[0]?.id;
  const minConfidence = params.minConfidence ? Number(params.minConfidence) : undefined;

  const matches = brandId ? await listMatches({ brandId, minConfidence }) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Brand matches"
        description="Creators scored against a brand on evidence, with a separate confidence score showing how far that evidence can be trusted."
        actions={<LinkButton href="/matches/accuracy" variant="secondary">Accuracy dashboard</LinkButton>}
      />

      {brands.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No matches scored yet"
          description="Matches are created when a brand is scored against your discovered creators. Open a brand and choose 'Score creators' to build the list."
          action={<LinkButton href="/brands">Go to brands</LinkButton>}
        />
      ) : (
        <>
          <Card className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-1.5">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/matches?brand=${brand.id}${minConfidence ? `&minConfidence=${minConfidence}` : ""}`}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    brand.id === brandId
                      ? "bg-indigo-600 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {brand.displayName}
                  <span className="ml-1.5 text-xs opacity-70">{brand._count.creatorMatches}</span>
                </Link>
              ))}
            </div>
            <div className="ml-auto flex gap-1.5 text-xs">
              <Link
                href={`/matches?brand=${brandId}`}
                className={`rounded-lg px-2.5 py-1.5 ${!minConfidence ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                All
              </Link>
              <Link
                href={`/matches?brand=${brandId}&minConfidence=45`}
                className={`rounded-lg px-2.5 py-1.5 ${minConfidence === 45 ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Confident only (≥45)
              </Link>
            </div>
          </Card>

          {matches.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No creators match this filter"
              description="Try removing the confidence filter, or analyse more creator videos to raise confidence."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
