"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { FilterOptions } from "@/lib/types";
import { useState, useEffect } from "react";

export default function FilterSidebar({
  filters,
  currentSet,
  currentRarity,
  currentFoiling,
  currentColor,
  currentType,
  currentQuery,
  currentInStock,
  currentShowPrintings,
  currentMinPrice,
  currentMaxPrice,
}: {
  filters: FilterOptions;
  currentSet?: string;
  currentRarity?: string;
  currentFoiling?: string;
  currentColor?: string;
  currentType?: string;
  currentQuery?: string;
  currentInStock?: boolean;
  currentShowPrintings?: boolean;
  currentMinPrice?: number;
  currentMaxPrice?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [min, setMin] = useState(currentMinPrice?.toString() || "");
  const [max, setMax] = useState(currentMaxPrice?.toString() || "");

  // Sync local state with URL if it changes externally
  useEffect(() => {
    setMin(currentMinPrice?.toString() || "");
  }, [currentMinPrice]);

  useEffect(() => {
    setMax(currentMaxPrice?.toString() || "");
  }, [currentMaxPrice]);

  function updateFilter(key: string, value: string | undefined) {
    // Determine new params
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/cards?${params.toString()}`);
  }

  function handlePriceApply() {
    const params = new URLSearchParams(searchParams.toString());
    if (min) params.set("minPrice", min);
    else params.delete("minPrice");

    if (max) params.set("maxPrice", max);
    else params.delete("maxPrice");

    params.delete("page");
    router.push(`/cards?${params.toString()}`);
  }

  const hasFilters =
    currentSet ||
    currentRarity ||
    currentFoiling ||
    currentColor ||
    currentType ||
    currentInStock ||
    currentShowPrintings ||
    currentMinPrice ||
    currentMaxPrice;

  return (
    <div className="space-y-6">
      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (currentQuery) params.set("q", currentQuery);
            router.push(`/cards?${params.toString()}`);
            setMin("");
            setMax("");
          }}
          className="text-sm text-red-500 hover:text-red-400"
        >
          Clear all filters
        </button>
      )}

      {/* Stock Filter */}
      <div className="flex items-center gap-2 cursor-pointer">
        <input
          id="stock-filter"
          type="checkbox"
          checked={!!currentInStock}
          onChange={(e) =>
            updateFilter("inStock", e.target.checked ? "true" : undefined)
          }
          className="w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 bg-gray-700"
        />
        <label htmlFor="stock-filter" className="text-sm text-gray-300 cursor-pointer">
          In Stock Only
        </label>
      </div>

      {/* Show Printings Filter */}
      <div className="flex items-center gap-2 cursor-pointer">
        <input
          id="printings-filter"
          type="checkbox"
          checked={!!currentShowPrintings}
          onChange={(e) =>
            updateFilter("showPrintings", e.target.checked ? "true" : undefined)
          }
          className="w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 bg-gray-700"
        />
        <label htmlFor="printings-filter" className="text-sm text-gray-300 cursor-pointer">
          Show All Versions
        </label>
      </div>

      {/* Price Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">
          Price (CAD)
        </h3>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-red-500 outline-none"
          />
          <span className="text-gray-500">-</span>
          <input
            type="number"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-red-500 outline-none"
          />
        </div>
        <button
          onClick={handlePriceApply}
          className="w-full bg-gray-700 hover:bg-gray-600 text-xs text-white py-1 rounded transition"
        >
          Apply Price Range
        </button>
      </div>

      {/* Set Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Set</h3>
        <select
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
          value={currentSet || ""}
          onChange={(e) => updateFilter("set", e.target.value || undefined)}
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
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
          value={currentRarity || ""}
          onChange={(e) => updateFilter("rarity", e.target.value || undefined)}
        >
          <option value="">All Rarities</option>
          {filters.rarities.map((r) => (
            <option key={r.unique_id} value={r.unique_id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Foiling Filter */}
      {filters.foilings && filters.foilings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Foiling</h3>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
            value={currentFoiling || ""}
            onChange={(e) => updateFilter("foiling", e.target.value || undefined)}
          >
            <option value="">All Foilings</option>
            {filters.foilings.map((f) => (
              <option key={f.unique_id} value={f.unique_id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Type / Class Filter */}
      {filters.classes && filters.classes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">
            Type / Class
          </h3>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
            value={currentType || ""}
            onChange={(e) =>
              updateFilter("type", e.target.value || undefined)
            }
          >
            <option value="">All Types</option>
            {filters.classes.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Color Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Color</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updateFilter("color", undefined)}
            className={`px-3 py-1 rounded text-sm transition ${!currentColor
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
          >
            All
          </button>
          {filters.colors.map((color) => (
            <button
              key={color}
              onClick={() => updateFilter("color", color)}
              className={`px-3 py-1 rounded text-sm capitalize transition ${currentColor === color
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
            >
              {color}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
