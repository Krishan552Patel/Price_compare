import { browseCards, getFilterOptions } from "@/lib/queries";
import CardGrid from "@/components/CardGrid";
import FilterSidebar from "@/components/FilterSidebar";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

// Helper to ensure data is safe for React rendering
function sanitizeCard(card: any): Card {
  return {
    unique_id: String(card.unique_id || ""),
    name: String(card.name || "Unknown Card"),
    color: card.color ? String(card.color) : null,
    pitch: card.pitch ? String(card.pitch) : null,
    cost: card.cost ? String(card.cost) : null,
    power: card.power ? String(card.power) : null,
    defense: card.defense ? String(card.defense) : null,
    health: card.health ? String(card.health) : null,
    intelligence: card.intelligence ? String(card.intelligence) : null,
    types: Array.isArray(card.types) ? card.types.map(String) : [],
    traits: Array.isArray(card.traits) ? card.traits.map(String) : [],
    card_keywords: Array.isArray(card.card_keywords)
      ? card.card_keywords.map(String)
      : [],
    functional_text: card.functional_text ? String(card.functional_text) : null,
    functional_text_plain: card.functional_text_plain
      ? String(card.functional_text_plain)
      : null,
    type_text: card.type_text ? String(card.type_text) : null,
    image_url: card.image_url ? String(card.image_url) : null,
    lowest_price: card.lowest_price != null ? Number(card.lowest_price) : null,
    blitz_legal: Number(card.blitz_legal || 0),
    cc_legal: Number(card.cc_legal || 0),
    commoner_legal: Number(card.commoner_legal || 0),
    ll_legal: Number(card.ll_legal || 0),
  };
}

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
  const type = params.type;
  const inStock = params.inStock === "true";
  const showPrintings = params.showPrintings === "true";
  const rawMinPrice = params.minPrice ? parseFloat(params.minPrice) : undefined;
  const rawMaxPrice = params.maxPrice ? parseFloat(params.maxPrice) : undefined;
  const minPrice = !isNaN(rawMinPrice || NaN) ? rawMinPrice : undefined;
  const maxPrice = !isNaN(rawMaxPrice || NaN) ? rawMaxPrice : undefined;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 24;

  let cards: Card[] = [];
  let total = 0;
  let filters: any = { sets: [], rarities: [], colors: [], classes: [] };
  let errorMsg = "";

  try {
    const [data, loadedFilters] = await Promise.all([
      browseCards({
        query,
        set,
        rarity,
        color,
        type,
        page,
        pageSize,
        minPrice,
        maxPrice,
        inStock,
        groupByPrinting: !!query || showPrintings,
      }),
      getFilterOptions(),
    ]);

    // Sanitize cards to prevent "Objects are not valid as a React child" errors
    cards = (data.cards || []).map(sanitizeCard);
    total = data.total || 0;
    filters = loadedFilters;
  } catch (err: any) {
    console.error("Error loading cards:", err);
    errorMsg = err.message || "Unknown error";
    // Fallback filters to prevent sidebar crash
    filters = { sets: [], rarities: [], colors: [], classes: [] };
  }

  const totalPages = Math.ceil(total / pageSize);

  // Build base URL for pagination
  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (set) baseParams.set("set", set);
  if (rarity) baseParams.set("rarity", rarity);
  if (color) baseParams.set("color", color);
  if (type) baseParams.set("type", type);
  if (inStock) baseParams.set("inStock", "true");
  if (minPrice) baseParams.set("minPrice", minPrice.toString());
  if (maxPrice) baseParams.set("maxPrice", maxPrice.toString());
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

      {errorMsg && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-8">
          <h3 className="font-bold">Error loading cards</h3>
          <p>{errorMsg}</p>
          <p className="text-xs mt-2 text-gray-400 font-mono">{JSON.stringify(errorMsg)}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-56 shrink-0">
          <FilterSidebar
            filters={filters}
            currentSet={set}
            currentRarity={rarity}
            currentColor={color}
            currentType={type}
            currentQuery={query}
            currentInStock={inStock}
            currentShowPrintings={showPrintings}
            currentMinPrice={minPrice}
            currentMaxPrice={maxPrice}
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
