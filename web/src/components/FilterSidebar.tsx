import type { FilterOptions } from "@/lib/types";
import Link from "next/link";

export default function FilterSidebar({
  filters,
  currentSet,
  currentRarity,
  currentColor,
  currentQuery,
}: {
  filters: FilterOptions;
  currentSet?: string;
  currentRarity?: string;
  currentColor?: string;
  currentQuery?: string;
}) {
  function buildUrl(params: Record<string, string | undefined>) {
    const searchParams = new URLSearchParams();
    if (currentQuery) searchParams.set("q", currentQuery);
    if (currentSet) searchParams.set("set", currentSet);
    if (currentRarity) searchParams.set("rarity", currentRarity);
    if (currentColor) searchParams.set("color", currentColor);

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        searchParams.set(key, value);
      } else {
        searchParams.delete(key);
      }
    }
    searchParams.delete("page");

    const qs = searchParams.toString();
    return `/cards${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Clear filters */}
      {(currentSet || currentRarity || currentColor) && (
        <Link
          href={currentQuery ? `/cards?q=${currentQuery}` : "/cards"}
          className="text-sm text-red-500 hover:text-red-400"
        >
          Clear all filters
        </Link>
      )}

      {/* Set Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Set</h3>
        <select
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          defaultValue={currentSet || ""}
          onChange={(e) => {
            const val = e.target.value;
            window.location.href = buildUrl({ set: val || undefined });
          }}
        >
          <option value="">All Sets</option>
          {filters.sets.map((s) => (
            <option key={s.set_code} value={s.set_code}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Rarity Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Rarity</h3>
        <select
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          defaultValue={currentRarity || ""}
          onChange={(e) => {
            const val = e.target.value;
            window.location.href = buildUrl({ rarity: val || undefined });
          }}
        >
          <option value="">All Rarities</option>
          {filters.rarities.map((r) => (
            <option key={r.unique_id} value={r.unique_id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Color Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Color</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildUrl({ color: undefined })}
            className={`px-3 py-1 rounded text-sm transition ${!currentColor ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
          >
            All
          </Link>
          {filters.colors.map((color) => (
            <Link
              key={color}
              href={buildUrl({ color })}
              className={`px-3 py-1 rounded text-sm capitalize transition ${currentColor === color ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              {color}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
