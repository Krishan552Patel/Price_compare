import { browseCards, getFilterOptions } from "@/lib/queries";
import CardGrid from "@/components/CardGrid";
import FilterSidebar from "@/components/FilterSidebar";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";

export const dynamic = "force-dynamic";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const query = params.q;
  const set = params.set;
  const rarity = params.rarity;
  const color = params.color;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 24;

  const [{ cards, total }, filters] = await Promise.all([
    browseCards({ query, set, rarity, color, page, pageSize }),
    getFilterOptions(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  // Build base URL for pagination
  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (set) baseParams.set("set", set);
  if (rarity) baseParams.set("rarity", rarity);
  if (color) baseParams.set("color", color);
  const baseUrl = `/cards${baseParams.toString() ? `?${baseParams.toString()}` : ""}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">
          {query ? `Results for "${query}"` : "Card Database"}
        </h1>
        <div className="max-w-md">
          <SearchBar />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-56 shrink-0">
          <FilterSidebar
            filters={filters}
            currentSet={set}
            currentRarity={rarity}
            currentColor={color}
            currentQuery={query}
          />
        </div>

        {/* Main content */}
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-4">
            {total.toLocaleString()} card{total !== 1 ? "s" : ""} found
          </p>
          <CardGrid cards={cards} />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl={baseUrl}
          />
        </div>
      </div>
    </div>
  );
}
