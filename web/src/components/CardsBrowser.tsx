"use client";

import { useState, useEffect } from "react";
import CardGrid from "./CardGrid";
import CardGridSkeleton from "./CardGridSkeleton";
import Pagination from "./Pagination";
import type { Card } from "@/lib/types";

const FILTER_KEYS = [
  "set", "rarity", "foiling", "edition", "color",
  "class", "pitch", "keyword", "subtype", "talent", "artVariation", "inStockOnly",
] as const;

interface CardsBrowserProps {
  initialCards?: Card[];
  initialTotal?: number;
  searchParams: {
    query?: string;
    sort?: string;
    density?: string;
    page?: number;
    [key: string]: string | number | undefined;
  };
}

export default function CardsBrowser({ initialCards, initialTotal, searchParams }: CardsBrowserProps) {
  const [cards, setCards] = useState<Card[]>(initialCards || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [loading, setLoading] = useState(!initialCards);
  const [error, setError] = useState<string | null>(null);

  const {
    query,
    sort = "name_asc",
    density = "regular",
    page = 1,
  } = searchParams;

  const pageSize = 24;
  const totalPages = Math.ceil(total / pageSize);

  // Build a stable key of all filter values to detect changes
  const filterKey = FILTER_KEYS.map((k) => `${k}=${searchParams[k] || ""}`).join("&");

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
        const p = new URLSearchParams();
        if (query) p.set("q", query);
        if (sort) p.set("sort", sort);
        p.set("page", page.toString());
        p.set("pageSize", pageSize.toString());

        // Pass filter params
        for (const key of FILTER_KEYS) {
          const val = searchParams[key];
          if (val !== undefined && val !== "") {
            p.set(key, String(val));
          }
        }

        const response = await fetch(`/api/cards/browse?${p.toString()}`, {
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
  }, [query, sort, page, filterKey, initialCards, initialTotal]);

  // Build base URL for pagination links
  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (sort && sort !== "name_asc") baseParams.set("sort", sort);
  if (density && density !== "regular") baseParams.set("density", density);
  // Preserve filters in pagination links
  for (const key of FILTER_KEYS) {
    const val = searchParams[key];
    if (val !== undefined && val !== "") {
      baseParams.set(key, String(val));
    }
  }

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
      <div className="mb-4">
        {loading ? (
          <span className="text-sm text-gray-500">Loading cards...</span>
        ) : (
          <span className="text-sm text-gray-400">
            {total.toLocaleString()} card{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <CardGridSkeleton count={pageSize} />
      ) : (
        <CardGrid cards={cards} density={density as "few" | "regular" | "many" | "most"} />
      )}

      {!loading && totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} baseUrl={baseUrl} />
      )}
    </>
  );
}
