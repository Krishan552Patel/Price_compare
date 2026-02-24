"use client";

import { useState } from "react";
import type { RetailerPrice } from "@/lib/types";
import { formatPrice, getRetailerColor } from "@/lib/utils";
import { StockBadge, FoilingBadge, ConditionBadge, RarityBadge } from "./Badge";

type StockFilter = "all" | "in_stock";
type ConditionFilter = "all" | "NM" | "LP" | "MP" | "HP" | "DMG";

export default function PriceTable({
  prices,
  initialPrintingId,
}: {
  prices: RetailerPrice[];
  initialPrintingId?: string;
}) {
  const initialHasStock = initialPrintingId
    ? prices.some((p) => p.printing_unique_id === initialPrintingId && p.in_stock)
    : false;

  const [stockFilter, setStockFilter] = useState<StockFilter>("in_stock");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
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

  const filtered = prices.filter((p) => {
    if (stockFilter === "in_stock" && !p.in_stock) return false;
    if (printingFilter !== "all" && p.printing_unique_id !== printingFilter) return false;
    if (conditionFilter !== "all" && p.condition !== conditionFilter) return false;
    return true;
  });

  const cheapest = filtered.find((p) => p.in_stock)?.price_cad;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Stock */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Stock:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {(
              [
                { value: "in_stock", label: "In Stock" },
                { value: "all", label: "All" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStockFilter(opt.value)}
                className={`px-3 py-1.5 text-xs transition ${
                  stockFilter === opt.value
                    ? "bg-red-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Cond:</span>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as ConditionFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
          >
            <option value="all">All</option>
            <option value="NM">NM</option>
            <option value="LP">LP</option>
            <option value="MP">MP</option>
            <option value="HP">HP</option>
            <option value="DMG">DMG</option>
          </select>
        </div>

        {/* Printing */}
        {uniquePrintings.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Print:</span>
            <select
              value={printingFilter}
              onChange={(e) => setPrintingFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white max-w-[180px]"
            >
              <option value="all">All ({uniquePrintings.length})</option>
              {uniquePrintings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No listings match your filters</p>
        </div>
      ) : (
        <>
          {/* ── Mobile card list (< sm) ── */}
          <div className="sm:hidden space-y-2">
            {filtered.map((price, i) => {
              const isCheapest = price.in_stock && price.price_cad === cheapest;
              return (
                <a
                  key={i}
                  href={price.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block bg-gray-800/50 border rounded-lg p-3 transition hover:border-gray-600 ${
                    !price.in_stock ? "opacity-50 border-gray-800" : "border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="font-semibold text-sm"
                      style={{ color: getRetailerColor(price.retailer_slug) }}
                    >
                      {price.retailer_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-base ${
                          isCheapest ? "text-green-400" : "text-white"
                        }`}
                      >
                        {formatPrice(price.price_cad)}{" "}
                        <span className="text-xs font-normal text-gray-500">CAD</span>
                      </span>
                      {isCheapest && (
                        <span className="text-[10px] font-bold bg-green-600/20 text-green-400 border border-green-600/40 px-1.5 py-0.5 rounded">
                          BEST
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-mono">{price.card_id}</span>
                    {(price.edition_name || price.edition) && (
                      <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">
                        {price.edition_name || price.edition}
                      </span>
                    )}
                    {(price.foiling_name || price.foiling) && (
                      <FoilingBadge foiling={price.foiling} foilingName={price.foiling_name} />
                    )}
                    {(price.rarity_name || price.rarity) && (
                      <RarityBadge rarity={price.rarity} rarityName={price.rarity_name} />
                    )}
                    <ConditionBadge condition={price.condition} />
                    <StockBadge inStock={price.in_stock} />
                  </div>
                </a>
              );
            })}
          </div>

          {/* ── Desktop table (≥ sm) ── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left py-3 px-2 w-[15%]">Store</th>
                  <th className="text-left py-3 px-2 w-[15%]">Printing</th>
                  <th className="text-left py-3 px-2 w-[25%]">Edition / Foiling</th>
                  <th className="text-center py-3 px-2 w-[10%]">Cond.</th>
                  <th className="text-right py-3 px-2 w-[14%]">Price (CAD)</th>
                  <th className="text-center py-3 px-2 w-[8%]">Stock</th>
                  <th className="text-right py-3 px-2 w-[13%]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((price, i) => {
                  const isCheapest = price.in_stock && price.price_cad === cheapest;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-800 ${!price.in_stock ? "opacity-50" : ""}`}
                    >
                      <td className="py-3 px-2">
                        <span
                          className="font-medium"
                          style={{ color: getRetailerColor(price.retailer_slug) }}
                        >
                          {price.retailer_name}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-white font-mono text-xs">{price.card_id}</div>
                        {price.set_name && (
                          <div className="text-gray-500 text-xs">{price.set_name}</div>
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
                            <RarityBadge rarity={price.rarity} rarityName={price.rarity_name} />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <ConditionBadge condition={price.condition} />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`font-bold ${isCheapest ? "text-green-400" : "text-white"}`}>
                          {formatPrice(price.price_cad)}
                        </span>
                        {isCheapest && (
                          <span className="ml-1 text-xs text-green-500">BEST</span>
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
        </>
      )}
    </div>
  );
}
