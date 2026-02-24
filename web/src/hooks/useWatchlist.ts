"use client";

/**
 * useWatchlist — auth-aware watchlist hook.
 *
 * - Logged in  → reads/writes server API (/api/account/watchlist)
 * - Guest      → reads/writes localStorage (unchanged behaviour)
 * - On first login, any local entries are auto-merged to the server.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { WatchlistEntry } from "@/lib/types";

const STORAGE_KEY = "fab_watchlist";

// ── localStorage helpers ───────────────────────────────────────────────────

function loadLocalEntries(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEntries(entries: WatchlistEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

function clearLocalEntries() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

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

// Module-level flag — sync only once per user per page load, even when
// the hook is mounted in multiple components at the same time.
let _syncedForUserId = "";

export function useWatchlist() {
  const { data: session, status } = useSession();
  const isAuth = status === "authenticated";
  const userId = session?.user?.id ?? "";

  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (status === "loading") return; // wait for session to resolve

    setIsLoaded(false);

    if (isAuth && userId) {
      // ── Authenticated: load from server + merge local entries once ────────
      (async () => {
        const serverEntries = await fetchServerEntries();

        if (_syncedForUserId !== userId) {
          _syncedForUserId = userId;

          const localEntries = loadLocalEntries();
          const serverIds = new Set(serverEntries.map((e) => e.cardUniqueId));
          const toSync = localEntries.filter((e) => !serverIds.has(e.cardUniqueId));

          if (toSync.length > 0) {
            // Upload any guest-added cards to the server
            await Promise.all(toSync.map((e) => serverAdd(e.cardUniqueId, e.priceAtAdd)));
            clearLocalEntries();
            const merged = await fetchServerEntries();
            setEntries(merged);
          } else {
            clearLocalEntries();
            setEntries(serverEntries);
          }
        } else {
          setEntries(serverEntries);
        }

        setIsLoaded(true);
      })();
    } else {
      // ── Guest: use localStorage ───────────────────────────────────────────
      setEntries(loadLocalEntries());
      setIsLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuth, userId, status]);

  // ── isWatching ─────────────────────────────────────────────────────────────

  const isWatching = useCallback(
    (cardUniqueId: string) => entries.some((e) => e.cardUniqueId === cardUniqueId),
    [entries]
  );

  // ── addToWatchlist ─────────────────────────────────────────────────────────

  const addToWatchlist = useCallback(
    ({ cardUniqueId, cardName, imageUrl, priceAtAdd }: AddToWatchlistArgs) => {
      const newEntry: WatchlistEntry = {
        cardUniqueId,
        cardName,
        imageUrl,
        priceAtAdd,
        addedAt: new Date().toISOString(),
      };

      // Optimistic update
      setEntries((prev) => {
        if (prev.some((e) => e.cardUniqueId === cardUniqueId)) return prev;
        const next = [...prev, newEntry];
        if (!isAuth) saveLocalEntries(next);
        return next;
      });

      if (isAuth) {
        serverAdd(cardUniqueId, priceAtAdd);
      }
    },
    [isAuth]
  );

  // ── removeFromWatchlist ────────────────────────────────────────────────────

  const removeFromWatchlist = useCallback(
    (cardUniqueId: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.cardUniqueId !== cardUniqueId);
        if (!isAuth) saveLocalEntries(next);
        return next;
      });

      if (isAuth) {
        serverRemove(cardUniqueId);
      }
    },
    [isAuth]
  );

  return { entries, isWatching, addToWatchlist, removeFromWatchlist, isLoaded };
}
