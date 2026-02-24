"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import WatchlistButton from "@/components/WatchlistButton";
import type { TrendingCard, FilterOptions } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────

const FOILING_NAMES: Record<string, string> = {
  S: "Standard",
  R: "Rainbow Foil",
  C: "Cold Foil",
  G: "Gold Cold Foil",
};

const RARITY_NAMES: Record<string, string> = {
  C: "Common",
  R: "Rare",
  S: "Super Rare",
  M: "Majestic",
  L: "Legendary",
  F: "Fabled",
  V: "Marvel",
  T: "Token",
  P: "Promo",
  B: "Bronze",
};

const EDITION_NAMES: Record<string, string> = {
  A: "Alpha",
  F: "First Edition",
  U: "Unlimited",
  N: "Normal",
};

const DAYS_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

const DIRECTION_OPTIONS = [
  { value: "both", label: "↕ All" },
  { value: "up", label: "↑ Up" },
  { value: "down", label: "↓ Down" },
] as const;

// ── Helpers ────────────────────────────────────────────────

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCAD(n: number) {
  return `CA$${Math.abs(n).toFixed(2)}`;
}

// ── Main Page ────────────────────────────────────────────────

export default function TrendingPage() {
  // Filters
  const [days, setDays] = useState<7 | 14 | 30 | 90>(7);
  const [direction, setDirection] = useState<"up" | "down" | "both">("both");
  const [minMove, setMinMove] = useState("1.00");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rarity, setRarity] = useState("");
  const [foiling, setFoiling] = useState("");
  const [set, setSet] = useState("");
  const [cardClass, setCardClass] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Data
  const [cards, setCards] = useState<TrendingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  // Load filter options once
  useEffect(() => {
    fetch("/api/cards/filters")
      .then((r) => r.json())
      .then(setFilterOptions)
      .catch(() => {});
  }, []);

  // Fetch trending data whenever filters change
  const fetchTrending = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set("days", String(days));
    p.set("direction", direction);
    p.set("minMove", minMove || "0");
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (rarity) p.set("rarity", rarity);
    if (foiling) p.set("foiling", foiling);
    if (set) p.set("set", set);
    if (cardClass) p.set("class", cardClass);

    fetch(`/api/cards/trending?${p.toString()}`)
      .then((r) => r.json())
      .then((data) => { setCards(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days, direction, minMove, minPrice, maxPrice, rarity, foiling, set, cardClass]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const upCount = cards.filter((c) => c.price_change > 0).length;
  const downCount = cards.filter((c) => c.price_change < 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Price Trends</h1>
        <p className="text-sm text-gray-400 mt-1">
          Cards with the biggest NM price movements over a selected timeframe.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 space-y-4">
        {/* Row 1: timeframe + direction */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Timeframe */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Timeframe
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {DAYS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value as 7 | 14 | 30 | 90)}
                  className={cx(
                    "px-4 py-2 text-sm font-medium transition",
                    days === opt.value
                      ? "bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Direction
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {DIRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDirection(opt.value)}
                  className={cx(
                    "px-4 py-2 text-sm font-medium transition",
                    direction === opt.value
                      ? opt.value === "up"
                        ? "bg-green-700 text-white"
                        : opt.value === "down"
                        ? "bg-red-700 text-white"
                        : "bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Min Move */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Min Move (CA$)
            </label>
            <input
              type="number"
              min="0"
              step="0.50"
              placeholder="1.00"
              value={minMove}
              onChange={(e) => setMinMove(e.target.value)}
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Price Range (CA$)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
              <span className="text-gray-600">–</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* More Filters toggle */}
          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={cx(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition self-end",
              (rarity || foiling || set || cardClass)
                ? "bg-red-600/20 border-red-500/60 text-red-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 8h12M9 12h6" />
            </svg>
            Card Filters
            {(rarity || foiling || set || cardClass) && (
              <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {[rarity, foiling, set, cardClass].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: optional card filters */}
        {showMoreFilters && filterOptions && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-800">
            {/* Rarity */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Rarity
              </label>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.rarities.map((r) => (
                  <button
                    key={r.unique_id}
                    onClick={() => setRarity(rarity === r.unique_id ? "" : r.unique_id)}
                    className={cx(
                      "px-2.5 py-1.5 rounded-md text-xs font-medium border transition",
                      rarity === r.unique_id
                        ? "bg-red-600/25 border-red-500/60 text-red-300"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                    )}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Foiling */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Foiling
              </label>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.foilings.map((f) => (
                  <button
                    key={f.unique_id}
                    onClick={() => setFoiling(foiling === f.unique_id ? "" : f.unique_id)}
                    className={cx(
                      "px-2.5 py-1.5 rounded-md text-xs font-medium border transition",
                      foiling === f.unique_id
                        ? "bg-red-600/25 border-red-500/60 text-red-300"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Set */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Set
              </label>
              <select
                value={set}
                onChange={(e) => setSet(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="">All Sets</option>
                {filterOptions.sets.map((s) => (
                  <option key={s.set_code} value={s.set_code}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Class
              </label>
              <select
                value={cardClass}
                onChange={(e) => setCardClass(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="">All Classes</option>
                {filterOptions.classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {!loading && cards.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-400">{cards.length} cards found</span>
          {upCount > 0 && (
            <span className="text-green-400">↑ {upCount} up</span>
          )}
          {downCount > 0 && (
            <span className="text-red-400">↓ {downCount} down</span>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <TrendingSkeletons />
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No price movements found</p>
          <p className="text-sm mt-2">
            Try expanding the timeframe or lowering the min move threshold.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <TrendingRow
              key={card.printing_unique_id}
              card={card}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Trending Row ────────────────────────────────────────────

function TrendingRow({ card }: { card: TrendingCard }) {
  const isUp = card.price_change > 0;
  const changeColor = isUp ? "text-green-400" : "text-red-400";
  const changeBg = isUp ? "bg-green-400/10" : "bg-red-400/10";
  const arrow = isUp ? "↑" : "↓";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition">
      {/* Mobile: stacked layout */}
      <div className="flex sm:hidden gap-3 p-3">
        <Link href={`/cards/${card.card_unique_id}`} className="shrink-0">
          <CardImage
            src={card.image_url}
            alt={card.card_name}
            width={60}
            height={84}
            className="rounded-md w-[60px] h-[84px] object-cover"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/cards/${card.card_unique_id}`} className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{card.card_name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{card.type_text}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <PrintingBadges card={card} />
              </div>
            </Link>
            <WatchlistButton
              cardUniqueId={card.card_unique_id}
              cardName={card.card_name}
              imageUrl={card.image_url}
              priceAtAdd={card.current_price}
              variant="icon"
            />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="text-xs text-gray-500">
              Was{" "}
              <span className="text-gray-300">{formatCAD(card.past_price)}</span>
            </div>
            <div className="text-xs text-gray-500">→</div>
            <div className="text-xs text-gray-300 font-semibold">
              {formatCAD(card.current_price)}
            </div>
            <div className={cx("ml-auto text-xs font-bold px-2 py-0.5 rounded-full", changeBg, changeColor)}>
              {arrow} {formatCAD(card.price_change)} ({card.percent_change > 0 ? "+" : ""}{card.percent_change}%)
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: row layout */}
      <div className="hidden sm:flex items-center gap-4 p-3">
        {/* Image */}
        <Link href={`/cards/${card.card_unique_id}`} className="shrink-0">
          <CardImage
            src={card.image_url}
            alt={card.card_name}
            width={48}
            height={67}
            className="rounded-md w-12 h-[67px] object-cover"
          />
        </Link>

        {/* Name + type */}
        <Link href={`/cards/${card.card_unique_id}`} className="w-56 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{card.card_name}</p>
          <p className="text-xs text-gray-500 truncate">{card.type_text}</p>
        </Link>

        {/* Badges */}
        <div className="hidden md:flex flex-wrap gap-1 flex-1 min-w-0">
          <PrintingBadges card={card} />
        </div>

        {/* Prices */}
        <div className="flex items-center gap-6 ml-auto shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">Was</p>
            <p className="text-sm font-mono text-gray-300">{formatCAD(card.past_price)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Now</p>
            <p className="text-sm font-mono font-bold text-white">{formatCAD(card.current_price)}</p>
          </div>
          <div className={cx(
            "text-right px-3 py-2 rounded-lg min-w-[100px]",
            changeBg
          )}>
            <p className={cx("text-base font-bold", changeColor)}>
              {arrow} {formatCAD(card.price_change)}
            </p>
            <p className={cx("text-xs", changeColor)}>
              {card.percent_change > 0 ? "+" : ""}{card.percent_change}%
            </p>
          </div>
          <WatchlistButton
            cardUniqueId={card.card_unique_id}
            cardName={card.card_name}
            imageUrl={card.image_url}
            priceAtAdd={card.current_price}
            variant="icon"
          />
        </div>
      </div>
    </div>
  );
}

function PrintingBadges({ card }: { card: TrendingCard }) {
  return (
    <>
      {card.set_name && (
        <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">
          {card.set_name}
        </span>
      )}
      {card.edition && EDITION_NAMES[card.edition] && (
        <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">
          {EDITION_NAMES[card.edition]}
        </span>
      )}
      {card.foiling && FOILING_NAMES[card.foiling] && (
        <span className="bg-yellow-900/40 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded">
          {FOILING_NAMES[card.foiling]}
        </span>
      )}
      {card.rarity && RARITY_NAMES[card.rarity] && (
        <span className="bg-gray-800 text-gray-300 text-[10px] px-1.5 py-0.5 rounded">
          {RARITY_NAMES[card.rarity]}
        </span>
      )}
    </>
  );
}

function TrendingSkeletons() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3 h-20 animate-pulse" />
      ))}
    </div>
  );
}
