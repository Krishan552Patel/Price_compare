"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";

export default function SearchBar({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

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

  function handleChange(value: string) {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(
          `/api/search?q=${encodeURIComponent(value)}`
        );
        const data = await resp.json();
        setResults(data);
        setIsOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      // Create a NEW URLSearchParams object based on current params
      // This ensures we keep existing filters (like set, rarity) when searching
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.set("q", query.trim());
      currentParams.delete("page"); // Reset page
      router.push(`/cards?${currentParams.toString()}`);
    }
  }

  function handleSelect(uniqueId: string) {
    setIsOpen(false);
    setQuery("");
    router.push(`/cards/${uniqueId}`);
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search cards..."
          className={`w-full bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition ${large ? "px-5 py-3 text-lg" : "px-3 py-2 text-sm"}`}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin" />
          </div>
        )}
      </form>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
          {results.map((result) => (
            <button
              key={result.unique_id}
              onClick={() => handleSelect(result.unique_id)}
              className="w-full text-left px-4 py-3 hover:bg-gray-700 transition flex items-center gap-3"
            >
              <div>
                <div className="text-white font-medium">{result.name}</div>
                {result.type_text && (
                  <div className="text-gray-400 text-sm">
                    {result.type_text}
                  </div>
                )}
              </div>
            </button>
          ))}
          <button
            onClick={handleSubmit}
            className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 border-t border-gray-700"
          >
            See all results for &ldquo;{query}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}
