"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCardSearch } from "@/hooks/useCardSearch";
import { normalizeCardId } from "@/lib/utils";
import type { SearchResult } from "@/lib/types";

// Known cards-page params to carry over when submitting a search from /cards.
// Prevents bleeding URL params from other pages (e.g. /trending?period=week).
const CARD_PAGE_PARAMS = new Set([
  "sort", "density", "view",
  "set", "rarity", "foiling", "edition", "color", "class", "pitch",
  "keyword", "subtype", "talent", "fusion", "specialization", "artVariation",
  "inStockOnly", "power", "health", "cost", "defense",
]);

export default function SearchBar({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Client-side search with Fuse.js - instant after initial load
  const { search, isLoading: indexLoading } = useCardSearch();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  function handleChange(value: string) {
    setQuery(value);

    if (value.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Instant local search - no debounce needed!
    const searchResults = search(value);
    setResults(searchResults);
    setIsOpen(searchResults.length > 0);
  }

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (query.trim()) {
        setIsOpen(false);
        const newParams = new URLSearchParams();
        // Only carry over known cards-page params when already on /cards.
        // This prevents other pages' URL params from leaking into the search URL.
        if (window.location.pathname === "/cards") {
          const current = new URLSearchParams(window.location.search);
          for (const [key, value] of current.entries()) {
            if (CARD_PAGE_PARAMS.has(key)) newParams.set(key, value);
          }
        }
        // Normalise short card-ID queries before navigating so the browse
        // page gets "WTR001" instead of "WTR01" for the ILIKE match.
        const q = normalizeCardId(query.trim());
        newParams.set("q", q);
        router.push(`/cards?${newParams.toString()}`);
      }
    },
    [query, router]
  );

  function handleSelect(uniqueId: string) {
    setIsOpen(false);
    setQuery("");
    router.push(`/cards/${uniqueId}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    // Total items = results + 1 "see all" button
    const totalItems = results.length + 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < totalItems - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : totalItems - 1
      );
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      if (highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex].unique_id);
      } else {
        // "See all results" item
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Search icon */}
          <svg
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 ${large ? "w-5 h-5" : "w-4 h-4"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder="Search cards, sets, card numbers..."
            className={`w-full bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition ${
              large ? "pl-11 pr-5 py-3 text-lg" : "pl-9 pr-3 py-2 text-sm"
            }`}
          />
          {indexLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </form>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={result.unique_id}
              onClick={() => handleSelect(result.unique_id)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full text-left px-3 py-2.5 transition flex items-center gap-3 ${
                highlightedIndex === index
                  ? "bg-gray-700"
                  : "hover:bg-gray-700/50"
              }`}
            >
              {/* Thumbnail */}
              <div className="w-8 h-11 rounded overflow-hidden bg-gray-700 shrink-0">
                {result.image_url ? (
                  <img
                    src={result.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-white text-sm font-medium truncate">
                  {result.name}
                </div>
                <div className="text-gray-400 text-xs truncate">
                  {result.type_text || ""}
                  {result.card_ids && (
                    <span className="ml-1 text-gray-600 font-mono">
                      {result.card_ids.split(" ")[0]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          <button
            onClick={() => handleSubmit()}
            onMouseEnter={() => setHighlightedIndex(results.length)}
            className={`w-full text-left px-3 py-2 text-sm text-gray-400 border-t border-gray-700 transition ${
              highlightedIndex === results.length
                ? "bg-gray-700"
                : "hover:bg-gray-700/50"
            }`}
          >
            See all results for &ldquo;{query}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}
