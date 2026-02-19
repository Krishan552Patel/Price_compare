import { Suspense } from "react";
import GridControls from "@/components/GridControls";
import SortSelect from "@/components/SortSelect";
import CardFilters from "@/components/CardFilters";
import CardsBrowser from "@/components/CardsBrowser";
import CardGridSkeleton from "@/components/CardGridSkeleton";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const query = params.q;
  const sort = params.sort || "name_asc";
  const density = params.density || "regular";
  const view = params.view || "grid";
  const page = parseInt(params.page || "1", 10);

  // Collect all filter params to pass through to CardsBrowser
  const filterParams: Record<string, string | undefined> = {};
  const filterKeys = [
    "set", "rarity", "foiling", "edition", "color",
    "class", "pitch", "keyword", "subtype", "talent", "fusion", "specialization", "artVariation", "inStockOnly",
    "power", "health", "cost", "defense",
  ];
  for (const key of filterKeys) {
    if (params[key]) filterParams[key] = params[key];
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {query ? `Results for "${query}"` : "Card Database"}
      </h1>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <CardFilters />

        <SortSelect currentSort={sort} />

        <div className="ml-auto">
          <GridControls currentDensity={density} currentView={view} />
        </div>
      </div>

      <Suspense fallback={<CardGridSkeleton />}>
        <CardsBrowser
          searchParams={{ query, sort, density, view, page, ...filterParams }}
        />
      </Suspense>
    </div>
  );
}
