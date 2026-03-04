"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Fuse, { IFuseOptions } from "fuse.js";
import type { SearchResult } from "@/lib/types";

// Raw entry as stored in localStorage / returned by API
interface CardIndexRaw {
  i: string;  // unique_id
  n: string;  // name
  t: string;  // type_text
  m: string;  // image_url
  c: string;  // card_ids space-joined (e.g. "WTR001 EVR034 1HP141")
  s: string;  // set_names space-joined
}

// Processed entry fed to Fuse — c is an array so Fuse matches each ID individually
interface CardIndexEntry {
  i: string;
  n: string;
  t: string;
  m: string;
  c: string[];  // split so Fuse scores "WTR001" against "WTR001" not "WTR001 EVR034"
  s: string;
}

const CACHE_KEY = "fab-card-index";
const CACHE_VERSION_KEY = "fab-card-index-version";
const CACHE_VERSION = "v3";

function processRaw(raw: CardIndexRaw[]): CardIndexEntry[] {
  return raw.map((r) => ({
    ...r,
    c: r.c ? r.c.split(" ").filter(Boolean) : [],
  }));
}

// Normalize card-number-style queries before searching:
//   "WTR 1"   → "WTR001"   (all-letter set code + space + number)
//   "1HP 141" → "1HP141"   (alphanumeric set code + space + number)
//   "EVR 34"  → "EVR034"
function normalizeQuery(q: string): string {
  return q.replace(/\b([A-Za-z0-9]{2,5})\s+(\d{1,3})\b/g, (_, prefix, digits) =>
    prefix.toUpperCase() + digits.padStart(3, "0")
  );
}

// Direct card-ID substring search — bypasses Fuse for code-like queries.
// Case-insensitive, strips spaces. Handles "1hp141", "WTR001", "wtr", etc.
function searchByCardId(raw: CardIndexRaw[], query: string): SearchResult[] {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const matches: SearchResult[] = [];
  for (const entry of raw) {
    const ids = entry.c.toLowerCase().split(" ").filter(Boolean);
    if (ids.some((id) => id.startsWith(q) || id === q)) {
      matches.push({
        unique_id: entry.i,
        name: entry.n,
        type_text: entry.t || null,
        image_url: entry.m || null,
        card_ids: entry.c || null,
      });
      if (matches.length >= 8) break;
    }
  }
  return matches;
}

// Pattern that looks like a card ID (alphanumeric, may start with digit, no spaces)
const CARD_ID_RE = /^[A-Za-z0-9]{2,10}$/;

const FUSE_OPTIONS: IFuseOptions<CardIndexEntry> = {
  keys: [
    { name: "n", weight: 1 },
    { name: "c", weight: 0.9 },
    { name: "s", weight: 0.4 },
    { name: "t", weight: 0.3 },
  ],
  threshold: 0.3,
  distance: 100,
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
  const rawRef = useRef<CardIndexRaw[]>([]);  // kept for direct card-ID search

  useEffect(() => {
    let cancelled = false;

    async function loadIndex() {
      try {
        const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
        const cachedData = localStorage.getItem(CACHE_KEY);

        if (cachedVersion === CACHE_VERSION && cachedData) {
          const raw = JSON.parse(cachedData) as CardIndexRaw[];
          if (raw.length > 0) {
            rawRef.current = raw;
            fuseRef.current = new Fuse(processRaw(raw), FUSE_OPTIONS);
            setCardCount(raw.length);
            setIsReady(true);
            setIsLoading(false);
            fetchAndUpdate(cancelled);
            return;
          }
        }

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

        const raw = (await response.json()) as CardIndexRaw[];

        if (!cancelled && raw.length > 0) {
          rawRef.current = raw;
          fuseRef.current = new Fuse(processRaw(raw), FUSE_OPTIONS);
          setCardCount(raw.length);
          setIsReady(true);
          setIsLoading(false);

          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
            localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
          } catch {
            // localStorage full, ignore
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
    return () => { cancelled = true; };
  }, []);

  const search = useCallback((query: string): SearchResult[] => {
    if (!query || query.length < 2) return [];

    // Normalize "WTR 1" → "WTR001", "1HP 141" → "1HP141", etc.
    const normalized = normalizeQuery(query);

    // For code-like queries (alphanumeric, no spaces), try direct card-ID
    // substring match first — this reliably handles "1hp141", "WTR001", etc.
    const stripped = normalized.replace(/\s+/g, "");
    if (CARD_ID_RE.test(stripped)) {
      const idMatches = searchByCardId(rawRef.current, stripped);
      if (idMatches.length > 0) return idMatches;
    }

    // Fall back to Fuse fuzzy search (names, set names, type text)
    if (!fuseRef.current) return [];
    const results = fuseRef.current.search(normalized, { limit: 8 });
    return results.map((result) => ({
      unique_id: result.item.i,
      name: result.item.n,
      type_text: result.item.t || null,
      image_url: result.item.m || null,
      card_ids: result.item.c.join(" ") || null,
    }));
  }, []);

  return { search, isLoading, isReady, error, cardCount };
}
