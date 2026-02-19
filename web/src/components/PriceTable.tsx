"use client";

import { useState } from "react";
import type { RetailerPrice } from "@/lib/types";
import { formatPrice, getRetailerColor } from "@/lib/utils";
import { StockBadge, FoilingBadge, ConditionBadge } from "./Badge";

type StockFilter = "all" | "in_stock";
type ConditionFilter = "all" | "NM" | "LP" | "MP" | "HP" | "DMG";

export default function PriceTable({
  prices,
  initialPrintingId,
}: {
  prices: RetailerPrice[];
  initialPrintingId?: string;
}) {
  // Check if the initial printing has any in-stock items
  const initialHasStock = initialPrintingId
    ? prices.some((p) => p.printing_unique_id === initialPrintingId && p.in_stock)
    : false;

  // Default to showing only in-stock items
  const [stockFilter, setStockFilter] = useState<StockFilter>("in_stock");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
  // If initial printing has no stock, default to "all" printings
  const [printingFilter, setPrintingFilter] = useState<string>(
    initialPrintingId && initialHasStock ? initialPrintingId : "all"
  );

  if (prices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No price data available for this card</p>
      </div>
    );
  }

  // Get unique printings for the filter dropdown
  const uniquePrintings = Array.from(
    new Map(
      prices.map((p) => [
        p.printing_unique_id,
        {
          id: p.printing_unique_id,
          label: [
            p.card_id,
            p.set_name || "",
            p.edition_name || p.edition || "",
            p.foiling_name || p.foiling || "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ])
    ).values()
  );

  // Apply filters
  const filtered = prices.filter((p) => {
    if (stockFilter === "in_stock" && !p.in_stock) return false;
    if (printingFilter !== "all" && p.printing_unique_id !== printingFilter)
      return false;
    if (conditionFilter !== "all" && p.condition !== conditionFilter)
      return false;
    return true;
  });

  const cheapest = filtered.find((p) => p.in_stock)?.price_cad;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 min-h-[40px] items-center">
        {/* Stock Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-10">Stock:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 w-[140px]">
            {(
              [
                { value: "in_stock", label: "In Stock" },
                { value: "all", label: "All" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStockFilter(opt.value)}
                className={`px-3 py-1.5 text-xs transition ${stockFilter === opt.value
                    ? "bg-red-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Condition Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Condition:</span>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as ConditionFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All Conditions</option>
            <option value="NM">Near Mint</option>
            <option value="LP">Lightly Played</option>
            <option value="MP">Moderately Played</option>
            <option value="HP">Heavily Played</option>
            <option value="DMG">Damaged</option>
          </select>
        </div>

        {/* Printing Filter */}
        {uniquePrintings.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Printing:</span>
            <select
              value={printingFilter}
              onChange={(e) => setPrintingFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="all">
                All Printings ({uniquePrintings.length})
              </option>
              {uniquePrintings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Result count */}
        <span className="text-xs text-gray-500 self-center ml-auto">
          {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No listings match your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-3 px-2 w-[15%]">Store</th>
                <th className="text-left py-3 px-2 w-[15%]">Printing</th>
                <th className="text-left py-3 px-2 w-[25%]">Edition / Foiling</th>
                <th className="text-center py-3 px-2 w-[10%]">Condition</th>
                <th className="text-right py-3 px-2 w-[12%]">Price</th>
                <th className="text-center py-3 px-2 w-[10%]">Stock</th>
                <th className="text-right py-3 px-2 w-[13%]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((price, i) => {
                const isCheapest =
                  price.in_stock && price.price_cad === cheapest;
                return (
                  <tr
                    key={i}
                    className={`border-b border-gray-800 ${!price.in_stock ? "opacity-50" : ""}`}
                  >
                    <td className="py-3 px-2">
                      <span
                        className="font-medium"
                        style={{
                          color: getRetailerColor(price.retailer_slug),
                        }}
                      >
                        {price.retailer_name}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-white font-mono text-xs">
                        {price.card_id}
                      </div>
                      {price.set_name && (
                        <div className="text-gray-500 text-xs">
                          {price.set_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {(price.edition_name || price.edition) && (
                          <span className="bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded">
                            {price.edition_name || price.edition}
                          </span>
                        )}
                        {(price.foiling_name || price.foiling) && (
                          <FoilingBadge foiling={price.foiling} foilingName={price.foiling_name} />
                        )}
                        {(price.rarity_name || price.rarity) && (
                          <span className="bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded">
                            {price.rarity_name || price.rarity}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <ConditionBadge condition={price.condition} />
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span
                        className={`font-bold ${isCheapest ? "text-green-400" : "text-white"}`}
                      >
                        {formatPrice(price.price_cad)}
                      </span>
                      {isCheapest && (
                        <span className="ml-1 text-xs text-green-500">
                          BEST
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <StockBadge inStock={price.in_stock} />
                    </td>
                    <td className="py-3 px-2 text-right">
                      <a
                        href={price.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                      >
                        Buy
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
