"use client";

import { useRouter, useSearchParams } from "next/navigation";

const retailers = [
  { value: "", label: "All Stores" },
  { value: "invasion", label: "Invasion" },
  { value: "gobelin", label: "Gobelin" },
  { value: "etb", label: "ETB" },
] as const;

const discountPresets = [
  { value: "", label: "Any" },
  { value: "10", label: "10%+" },
  { value: "20", label: "20%+" },
  { value: "30", label: "30%+" },
  { value: "50", label: "50%+" },
] as const;

const sortOptions = [
  { value: "discount_desc", label: "Biggest Discount" },
  { value: "price_asc", label: "Lowest Price" },
  { value: "price_desc", label: "Highest Price" },
] as const;

export default function DealsToolbar({
  currentRetailer,
  currentMinDiscount,
  currentSort,
}: {
  currentRetailer?: string;
  currentMinDiscount?: string;
  currentSort?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/deals?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Store filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Store:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {retailers.map((r) => (
            <button
              key={r.value}
              onClick={() => updateParam("retailer", r.value)}
              className={`px-3 py-1.5 text-xs transition ${
                (currentRetailer || "") === r.value
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Min discount */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Min Discount:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {discountPresets.map((d) => (
            <button
              key={d.value}
              onClick={() => updateParam("minDiscount", d.value)}
              className={`px-3 py-1.5 text-xs transition ${
                (currentMinDiscount || "") === d.value
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <select
        value={currentSort || "discount_desc"}
        onChange={(e) => updateParam("sort", e.target.value === "discount_desc" ? "" : e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-red-500 outline-none"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
