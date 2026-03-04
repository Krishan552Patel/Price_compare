"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CardImage from "@/components/CardImage";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry } from "@/lib/types";

function formatCAD(n: number) {
  return `CA$${n.toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface PriceMap {
  [cardUniqueId: string]: number | undefined;
}

export default function WatchlistPage() {
  const { status } = useSession();
  const { entries, removeFromWatchlist, isLoaded } = useWatchlist();
  const [currentPrices, setCurrentPrices] = useState<PriceMap>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  // Fetch current prices for all watched cards
  useEffect(() => {
    if (!isLoaded || entries.length === 0) {
      setCurrentPrices({});
      return;
    }
    setPricesLoading(true);
    const ids = entries.map((e) => e.cardUniqueId).join(",");
    fetch(`/api/watchlist/prices?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((data: PriceMap) => {
        setCurrentPrices(data);
        setPricesLoading(false);
      })
      .catch(() => setPricesLoading(false));
  }, [isLoaded, entries]);

  if (status === "unauthenticated") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
          <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Watchlist</h1>
        <p className="text-gray-400 mb-6">Sign in to track cards and monitor price changes.</p>
        <Link
          href="/login?callbackUrl=/watchlist"
          className="inline-block px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (status === "loading" || !isLoaded) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Watchlist</h1>
        <p className="text-sm text-gray-400 mt-1">
          Tracking {entries.length} card{entries.length !== 1 ? "s" : ""} — prices are NM in-stock.
        </p>
      </div>

      {entries.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <WatchlistRow
              key={entry.cardUniqueId}
              entry={entry}
              currentPrice={currentPrices[entry.cardUniqueId]}
              pricesLoading={pricesLoading}
              onRemove={() => removeFromWatchlist(entry.cardUniqueId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────

function WatchlistRow({
  entry,
  currentPrice,
  pricesLoading,
  onRemove,
}: {
  entry: WatchlistEntry;
  currentPrice: number | undefined;
  pricesLoading: boolean;
  onRemove: () => void;
}) {
  const hasBoth = entry.priceAtAdd != null && currentPrice != null;
  const priceChange = hasBoth ? currentPrice! - entry.priceAtAdd! : null;
  const percentChange =
    hasBoth && entry.priceAtAdd !== 0
      ? ((currentPrice! - entry.priceAtAdd!) / entry.priceAtAdd!) * 100
      : null;

  const isUp = priceChange != null && priceChange > 0;
  const isDown = priceChange != null && priceChange < 0;
  const changeColor = isUp ? "text-green-400" : isDown ? "text-red-400" : "text-gray-400";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition">
      {/* Mobile */}
      <div className="flex sm:hidden gap-3 p-3">
        <Link href={`/cards/${entry.cardUniqueId}`} className="shrink-0">
          <CardImage
            src={entry.imageUrl}
            alt={entry.cardName}
            width={56}
            height={78}
            className="rounded-md w-14 h-[78px] object-cover"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/cards/${entry.cardUniqueId}`}>
            <p className="font-semibold text-white text-sm truncate">{entry.cardName}</p>
          </Link>
          <p className="text-xs text-gray-500 mt-0.5">Added {formatDate(entry.addedAt)}</p>
          <div className="flex items-center gap-3 mt-2">
            <div>
              <p className="text-[10px] text-gray-500">Added at</p>
              <p className="text-xs font-mono text-gray-300">
                {entry.priceAtAdd != null ? formatCAD(entry.priceAtAdd) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Now (NM)</p>
              <p className="text-xs font-mono text-white">
                {pricesLoading ? "…" : currentPrice != null ? formatCAD(currentPrice) : "—"}
              </p>
            </div>
            {priceChange != null && (
              <div className={`ml-auto text-xs font-bold ${changeColor}`}>
                {isUp ? "↑" : isDown ? "↓" : ""}
                {" "}{formatCAD(Math.abs(priceChange))}
                {percentChange != null && (
                  <span className="ml-1">({percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%)</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onRemove}
            className="mt-2 text-xs text-gray-600 hover:text-red-400 transition"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-4 p-3">
        <Link href={`/cards/${entry.cardUniqueId}`} className="shrink-0">
          <CardImage
            src={entry.imageUrl}
            alt={entry.cardName}
            width={52}
            height={73}
            className="rounded-md w-[52px] h-[73px] object-cover"
          />
        </Link>

        <Link href={`/cards/${entry.cardUniqueId}`} className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{entry.cardName}</p>
          <p className="text-xs text-gray-500 mt-0.5">Added {formatDate(entry.addedAt)}</p>
        </Link>

        {/* Prices */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">Added at</p>
            <p className="text-sm font-mono text-gray-300">
              {entry.priceAtAdd != null ? formatCAD(entry.priceAtAdd) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Now (NM)</p>
            <p className="text-sm font-mono font-bold text-white">
              {pricesLoading ? (
                <span className="inline-block w-16 h-4 bg-gray-800 animate-pulse rounded" />
              ) : currentPrice != null ? (
                formatCAD(currentPrice)
              ) : (
                <span className="text-gray-600">—</span>
              )}
            </p>
          </div>

          {/* Change */}
          <div className="w-28 text-right">
            {priceChange != null ? (
              <div className={changeColor}>
                <p className="text-sm font-bold">
                  {isUp ? "↑" : isDown ? "↓" : ""} {formatCAD(Math.abs(priceChange))}
                </p>
                {percentChange != null && (
                  <p className="text-xs">
                    {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
                  </p>
                )}
              </div>
            ) : (
              <span className="text-gray-600 text-sm">—</span>
            )}
          </div>

          <button
            onClick={onRemove}
            title="Remove from watchlist"
            className="text-gray-600 hover:text-red-400 transition p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
        <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
        </svg>
      </div>
      <p className="text-gray-400 font-medium">Your watchlist is empty</p>
      <p className="text-sm text-gray-600 mt-1">
        Add cards from the{" "}
        <Link href="/cards" className="text-red-400 hover:text-red-300 underline">
          browse page
        </Link>{" "}
        or{" "}
        <Link href="/trending" className="text-red-400 hover:text-red-300 underline">
          trending
        </Link>
        .
      </p>
    </div>
  );
}
