"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Fuse, { IFuseOptions } from "fuse.js";
import type { SearchResult } from "@/lib/types";

// Compressed card index entry from API
interface CardIndexEntry {
  i: string;  // unique_id
  n: string;  // name
  t: string;  // type_text
  m: string;  // image_url
}

// LocalStorage key for caching
const CACHE_KEY = "fab-card-index";
const CACHE_VERSION_KEY = "fab-card-index-version";
const CACHE_VERSION = "v1";

// Fuse.js options for fuzzy search
const FUSE_OPTIONS: IFuseOptions<CardIndexEntry> = {
  keys: [
    { name: "n", weight: 1 },    // name (highest priority)
    { name: "t", weight: 0.3 },  // type_text
  ],
  threshold: 0.3,        // 0 = exact, 1 = match anything
  distance: 100,         // how far to search for fuzzy match
  minMatchCharLength: 2,
  includeScore: true,
  shouldSort: true,
};

interface UseCardSearchResult {
  search: (query: string) => SearchResult[];
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  cardCount: number;
}

export function useCardSearch(): UseCardSearchResult {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState(0);
  const fuseRef = useRef<Fuse<CardIndexEntry> | null>(null);
  const indexRef = useRef<CardIndexEntry[]>([]);

  // Load index on mount
  useEffect(() => {
    let cancelled = false;

    async function loadIndex() {
      try {
        // Try localStorage first
        const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
        const cachedData = localStorage.getItem(CACHE_KEY);
        
        if (cachedVersion === CACHE_VERSION && cachedData) {
          const parsed = JSON.parse(cachedData) as CardIndexEntry[];
          if (parsed.length > 0) {
            indexRef.current = parsed;
            fuseRef.current = new Fuse(parsed, FUSE_OPTIONS);
            setCardCount(parsed.length);
            setIsReady(true);
            setIsLoading(false);
            
            // Refresh in background (stale-while-revalidate pattern)
            fetchAndUpdate(cancelled);
            return;
          }
        }

        // No cache, fetch from API
        await fetchAndUpdate(cancelled);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load card index");
          setIsLoading(false);
        }
      }
    }

    async function fetchAndUpdate(cancelled: boolean) {
      try {
        const response = await fetch("/api/cards/index");
        if (!response.ok) throw new Error("Failed to fetch card index");
        
        const data = (await response.json()) as CardIndexEntry[];
        
        if (!cancelled && data.length > 0) {
          // Update refs
          indexRef.current = data;
          fuseRef.current = new Fuse(data, FUSE_OPTIONS);
          setCardCount(data.length);
          setIsReady(true);
          setIsLoading(false);
          
          // Update localStorage cache
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
          } catch {
            // localStorage might be full, ignore
          }
        }
      } catch (err) {
        if (!cancelled && !isReady) {
          setError(err instanceof Error ? err.message : "Failed to fetch");
          setIsLoading(false);
        }
      }
    }

    loadIndex();

    return () => {
      cancelled = true;
    };
  }, []);

  // Search function - instant, runs locally
  const search = useCallback((query: string): SearchResult[] => {
    if (!fuseRef.current || !query || query.length < 2) {
      return [];
    }

    const results = fuseRef.current.search(query, { limit: 8 });
    
    return results.map((result) => ({
      unique_id: result.item.i,
      name: result.item.n,
      type_text: result.item.t || null,
      image_url: result.item.m || null,
    }));
  }, []);

  return {
    search,
    isLoading,
    isReady,
    error,
    cardCount,
  };
}
