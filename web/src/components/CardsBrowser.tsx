"use client";

import { useState, useEffect } from "react";
import CardGrid from "./CardGrid";
import CardGridSkeleton from "./CardGridSkeleton";
import Pagination from "./Pagination";
import type { Card } from "@/lib/types";

interface CardsBrowserProps {
  initialCards?: Card[];
  initialTotal?: number;
  searchParams: {
    query?: string;
    set?: string;
    rarity?: string;
    foiling?: string;
    color?: string;
    type?: string;
    sort?: string;
    density?: string;
    inStock?: boolean;
    showPrintings?: boolean;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
  };
}

export default function CardsBrowser({ initialCards, initialTotal, searchParams }: CardsBrowserProps) {
  const [cards, setCards] = useState<Card[]>(initialCards || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [loading, setLoading] = useState(!initialCards);
  const [error, setError] = useState<string | null>(null);

  const {
    query,
    set,
    rarity,
    foiling,
    color,
    type,
    sort = "name_asc",
    density = "regular",
    inStock,
    showPrintings,
    minPrice,
    maxPrice,
    page = 1,
  } = searchParams;

  const pageSize = 24;
  const totalPages = Math.ceil(total / pageSize);

  // Fetch cards when params change (only if no initial data)
  useEffect(() => {
    if (initialCards && initialTotal !== undefined) {
      setCards(initialCards);
      setTotal(initialTotal);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    
    async function fetchCards() {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (set) params.set("set", set);
        if (rarity) params.set("rarity", rarity);
        if (foiling) params.set("foiling", foiling);
        if (color) params.set("color", color);
        if (type) params.set("type", type);
        if (sort) params.set("sort", sort);
        if (inStock) params.set("inStock", "true");
        if (showPrintings) params.set("showPrintings", "true");
        if (minPrice) params.set("minPrice", minPrice.toString());
        if (maxPrice) params.set("maxPrice", maxPrice.toString());
        params.set("page", page.toString());
        params.set("pageSize", pageSize.toString());

        const response = await fetch(`/api/cards/browse?${params.toString()}`, {
          signal: controller.signal,
        });
        
        if (!response.ok) throw new Error("Failed to fetch cards");
        
        const data = await response.json();
        setCards(data.cards || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCards();
    
    return () => controller.abort();
  }, [query, set, rarity, foiling, color, type, sort, inStock, showPrintings, minPrice, maxPrice, page, initialCards, initialTotal]);

  // Build base URL for pagination
  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (set) baseParams.set("set", set);
  if (rarity) baseParams.set("rarity", rarity);
  if (foiling) baseParams.set("foiling", foiling);
  if (color) baseParams.set("color", color);
  if (type) baseParams.set("type", type);
  if (sort && sort !== "name_asc") baseParams.set("sort", sort);
  if (density && density !== "regular") baseParams.set("density", density);
  if (inStock) baseParams.set("inStock", "true");
  if (showPrintings) baseParams.set("showPrintings", "true");
  if (minPrice) baseParams.set("minPrice", minPrice.toString());
  if (maxPrice) baseParams.set("maxPrice", maxPrice.toString());
  const baseUrl = `/cards${baseParams.toString() ? `?${baseParams.toString()}` : ""}`;

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6">
        <h3 className="font-bold">Error loading cards</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Card count */}
      <div className="mb-4">
        {loading ? (
          <span className="text-sm text-gray-500">Loading cards...</span>
        ) : (
          <span className="text-sm text-gray-400">
            {total.toLocaleString()} card{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Card Grid or Skeleton */}
      {loading ? (
        <CardGridSkeleton count={pageSize} />
      ) : (
        <CardGrid
          cards={cards}
          density={density as "few" | "regular" | "many" | "most"}
        />
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl={baseUrl}
        />
      )}
    </>
  );
}
