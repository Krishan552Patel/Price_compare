import { Suspense } from "react";
import { getFilterOptions } from "@/lib/queries";
import FilterDrawer from "@/components/FilterDrawer";
import GridControls from "@/components/GridControls";
import SortSelect from "@/components/SortSelect";
import CardsBrowser from "@/components/CardsBrowser";
import CardGridSkeleton from "@/components/CardGridSkeleton";

// Load filter options server-side (fast, cached)
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const query = params.q;
  const set = params.set;
  const rarity = params.rarity;
  const foiling = params.foiling;
  const color = params.color;
  const type = params.type;
  const sort = params.sort || "name_asc";
  const density = params.density || "regular";
  const inStock = params.inStock === "true";
  const showPrintings = params.showPrintings === "true";
  const rawMinPrice = params.minPrice ? parseFloat(params.minPrice) : undefined;
  const rawMaxPrice = params.maxPrice ? parseFloat(params.maxPrice) : undefined;
  const minPrice = !isNaN(rawMinPrice || NaN) ? rawMinPrice : undefined;
  const maxPrice = !isNaN(rawMaxPrice || NaN) ? rawMaxPrice : undefined;
  const page = parseInt(params.page || "1", 10);

  // Load filters server-side (cached for 5 min)
  let filters: Awaited<ReturnType<typeof getFilterOptions>> = { sets: [], rarities: [], foilings: [], colors: [], classes: [] };
  try {
    filters = await getFilterOptions();
  } catch (err) {
    console.error("Error loading filters:", err);
  }

  // Count active filters
  const filterCount = [set, rarity, foiling, color, type, inStock, showPrintings, minPrice, maxPrice]
    .filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page title */}
      <h1 className="text-3xl font-bold mb-6">
        {query ? `Results for "${query}"` : "Card Database"}
      </h1>

      {/* Toolbar - renders immediately */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <FilterDrawer
          filters={filters}
          filterCount={filterCount}
          currentSet={set}
          currentRarity={rarity}
          currentFoiling={foiling}
          currentColor={color}
          currentType={type}
          currentQuery={query}
          currentInStock={inStock}
          currentShowPrintings={showPrintings}
          currentMinPrice={minPrice}
          currentMaxPrice={maxPrice}
        />

        <SortSelect currentSort={sort} />

        <div className="ml-auto hidden sm:block">
          <GridControls currentDensity={density} />
        </div>
      </div>

      {/* Card Grid - shows skeleton immediately, loads data client-side */}
      <Suspense fallback={<CardGridSkeleton />}>
        <CardsBrowser
          searchParams={{
            query,
            set,
            rarity,
            foiling,
            color,
            type,
            sort,
            density,
            inStock,
            showPrintings,
            minPrice,
            maxPrice,
            page,
          }}
        />
      </Suspense>
    </div>
  );
}
