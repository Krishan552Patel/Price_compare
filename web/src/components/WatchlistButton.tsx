"use client";

import { useWatchlist } from "@/hooks/useWatchlist";

interface Props {
  cardUniqueId: string;
  cardName: string;
  imageUrl: string | null;
  priceAtAdd: number | null;
  /** "icon" = compact button for card grid overlays, "pill" = full label button */
  variant?: "icon" | "pill";
  className?: string;
}

export default function WatchlistButton({
  cardUniqueId,
  cardName,
  imageUrl,
  priceAtAdd,
  variant = "icon",
  className = "",
}: Props) {
  const { isWatching, addToWatchlist, removeFromWatchlist, isLoaded, isAuth } =
    useWatchlist();

  if (!isLoaded || !isAuth) return null;

  const watching = isWatching(cardUniqueId);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (watching) {
      removeFromWatchlist(cardUniqueId);
    } else {
      addToWatchlist({ cardUniqueId, cardName, imageUrl, priceAtAdd });
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={toggle}
        title={watching ? "Remove from watchlist" : "Add to watchlist"}
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-150 shadow
          ${watching
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-gray-900/80 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-700"
          } ${className}`}
      >
        {watching ? (
          /* Filled bookmark */
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
          </svg>
        ) : (
          /* Outline bookmark */
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
          </svg>
        )}
      </button>
    );
  }

  // pill variant
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150
        ${watching
          ? "bg-red-600/20 border-red-500/60 text-red-400 hover:bg-red-600/30"
          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white"
        } ${className}`}
    >
      {watching ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3a2 2 0 00-2 2v16l9-4 9 4V5a2 2 0 00-2-2H5z" />
        </svg>
      )}
      {watching ? "Watching" : "Add to Watchlist"}
    </button>
  );
}
