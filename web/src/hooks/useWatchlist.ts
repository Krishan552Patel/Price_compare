"use client";

/**
 * useWatchlist — auth-only watchlist hook.
 *
 * Watchlist requires sign-in. Guests receive empty state and no-op functions.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { WatchlistEntry } from "@/lib/types";

// ── Server API helpers ─────────────────────────────────────────────────────

async function fetchServerEntries(): Promise<WatchlistEntry[]> {
  try {
    const res = await fetch("/api/account/watchlist");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function serverAdd(cardUniqueId: string, priceAtAdd: number | null) {
  await fetch("/api/account/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardUniqueId, priceAtAdd }),
  });
}

async function serverRemove(cardUniqueId: string) {
  await fetch("/api/account/watchlist", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardUniqueId }),
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────

export interface AddToWatchlistArgs {
  cardUniqueId: string;
  cardName: string;
  imageUrl: string | null;
  priceAtAdd: number | null;
}

export function useWatchlist() {
  const { status } = useSession();
  const isAuth = status === "authenticated";

  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (!isAuth) {
      setEntries([]);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    fetchServerEntries().then((serverEntries) => {
      setEntries(serverEntries);
      setIsLoaded(true);
    });
  }, [isAuth, status]);

  const isWatching = useCallback(
    (cardUniqueId: string) => entries.some((e) => e.cardUniqueId === cardUniqueId),
    [entries]
  );

  const addToWatchlist = useCallback(
    ({ cardUniqueId, cardName, imageUrl, priceAtAdd }: AddToWatchlistArgs) => {
      if (!isAuth) return;
      const newEntry: WatchlistEntry = {
        cardUniqueId,
        cardName,
        imageUrl,
        priceAtAdd,
        addedAt: new Date().toISOString(),
      };
      setEntries((prev) => {
        if (prev.some((e) => e.cardUniqueId === cardUniqueId)) return prev;
        return [...prev, newEntry];
      });
      serverAdd(cardUniqueId, priceAtAdd);
    },
    [isAuth]
  );

  const removeFromWatchlist = useCallback(
    (cardUniqueId: string) => {
      if (!isAuth) return;
      setEntries((prev) => prev.filter((e) => e.cardUniqueId !== cardUniqueId));
      serverRemove(cardUniqueId);
    },
    [isAuth]
  );

  return { entries, isWatching, addToWatchlist, removeFromWatchlist, isLoaded, isAuth };
}
