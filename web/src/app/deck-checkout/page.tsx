"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CardImage from "@/components/CardImage";
import type {
  DeckCheckoutResponseV2,
  DeckCheckoutResultV2,
  DeckCardOption,
} from "@/lib/types";

// ── Label maps ────────────────────────────────────────────────────────────────
const FOILING_LABELS: Record<string, string> = {
  S: "NF", R: "RF", C: "CF", G: "GF",
};
const FOILING_NAMES: Record<string, string> = {
  S: "Standard", R: "Rainbow Foil", C: "Cold Foil", G: "Gold Cold Foil",
};
const FOILING_ORDER = ["S", "R", "C", "G"];
const EDITION_LABELS: Record<string, string> = {
  A: "Alpha", F: "1st", U: "Unlim", N: "",
};
const RARITY_LABELS: Record<string, string> = {
  C: "Common", R: "Rare", S: "Super Rare", M: "Majestic",
  L: "Legendary", F: "Fabled", V: "Marvel", T: "Token", P: "Promo",
};
const RETAILER_COLORS: Record<string, string> = {
  invasion: "#ef4444",
  gobelin: "#22c55e",
  etb: "#3b82f6",
};
const RETAILER_DOMAINS: Record<string, string> = {
  invasion: "https://invasioncnc.ca",
  gobelin: "https://gobelindargent.ca",
  etb: "https://enterthebattlefield.ca",
};

function formatCAD(n: number) {
  return `CA$${n.toFixed(2)}`;
}

function cardKey(r: DeckCheckoutResultV2) {
  return `${r.input.name.toLowerCase()}|${r.input.pitch ?? ""}`;
}

// Foilings available for a card within the selected retailers
function getAvailableFoilings(
  options: DeckCardOption[],
  selectedRetailers: Set<string>
): string[] {
  const foilings = new Set(
    options
      .filter((o) => selectedRetailers.has(o.retailerSlug))
      .map((o) => o.foiling ?? "S")
  );
  return FOILING_ORDER.filter((f) => foilings.has(f));
}

// Options for a specific foiling filtered to selected retailers, sorted by price
function getOptionsForFoiling(
  options: DeckCardOption[],
  foiling: string,
  selectedRetailers: Set<string>
): DeckCardOption[] {
  return options
    .filter(
      (o) =>
        (o.foiling ?? "S") === foiling && selectedRetailers.has(o.retailerSlug)
    )
    .sort((a, b) => a.price - b.price);
}

function buildCartUrl(slug: string, map: Map<string, number>): string | null {
  const domain = RETAILER_DOMAINS[slug];
  if (!domain || map.size === 0) return null;
  return `${domain}/cart/${Array.from(map.entries())
    .map(([v, q]) => `${v}:${q}`)
    .join(",")}`;
}

// ── Sign-in prompt ────────────────────────────────────────────────────────────
function SignInPrompt() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
        <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.874-7.148a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Deck Checkout</h1>
      <p className="text-gray-400 mb-6">
        Sign in to compare prices across shops, choose your foiling, and get direct cart links.
      </p>
      <Link
        href="/login?callbackUrl=/deck-checkout"
        className="inline-block px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition"
      >
        Sign In
      </Link>
    </div>
  );
}

// ── Retailer toggles ──────────────────────────────────────────────────────────
function RetailerToggles({
  retailers,
  selected,
  onToggle,
}: {
  retailers: { slug: string; name: string }[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500 mr-1">Shops:</span>
      {retailers.map((r) => {
        const active = selected.has(r.slug);
        const color = RETAILER_COLORS[r.slug] ?? "#6b7280";
        return (
          <button
            key={r.slug}
            onClick={() => onToggle(r.slug)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
              active
                ? "border-transparent text-white"
                : "border-gray-700 text-gray-500 bg-transparent"
            }`}
            style={active ? { backgroundColor: color } : {}}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: active ? "rgba(255,255,255,0.6)" : color }}
            />
            {r.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Single card row ───────────────────────────────────────────────────────────
function CardRow({
  result,
  selectedRetailers,
  foiling,
  onFoilingChange,
  retailers,
}: {
  result: DeckCheckoutResultV2;
  selectedRetailers: Set<string>;
  foiling: string;
  onFoilingChange: (key: string, foiling: string) => void;
  retailers: { slug: string; name: string }[];
}) {
  const key = cardKey(result);
  const availableFoilings = getAvailableFoilings(result.options, selectedRetailers);
  const optionsForFoiling = getOptionsForFoiling(result.options, foiling, selectedRetailers);
  const cheapestPrice = optionsForFoiling[0]?.price ?? null;
  const notAvailable = availableFoilings.length === 0;

  // Cheapest price for each foiling (for pill labels)
  const foilingPrices: Record<string, number> = {};
  for (const f of FOILING_ORDER) {
    const opts = getOptionsForFoiling(result.options, f, selectedRetailers);
    if (opts.length > 0) foilingPrices[f] = opts[0].price;
  }

  const pitchLabel =
    result.input.pitch === "1"
      ? "red"
      : result.input.pitch === "2"
      ? "yellow"
      : result.input.pitch === "3"
      ? "blue"
      : null;

  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3 border-b border-gray-800/60 last:border-0 ${
        notAvailable ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Card image */}
        <Link
          href={result.cardUniqueId ? `/cards/${result.cardUniqueId}` : "#"}
          className="shrink-0"
        >
          <CardImage
            src={result.imageUrl}
            alt={result.cardName ?? result.input.name}
            width={36}
            height={50}
            className="rounded w-9 h-[50px] object-cover"
          />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Name + qty */}
          <div className="flex items-baseline justify-between gap-2">
            <Link
              href={result.cardUniqueId ? `/cards/${result.cardUniqueId}` : "#"}
            >
              <p className="text-sm font-medium text-white truncate">
                {result.cardName ?? result.input.name}
              </p>
            </Link>
            <span className="text-xs text-gray-500 shrink-0">
              ×{result.input.qty}
            </span>
          </div>
          {pitchLabel && (
            <p className="text-xs text-gray-600">{pitchLabel}</p>
          )}

          {notAvailable ? (
            <p className="text-xs text-yellow-500 mt-1">Not in stock</p>
          ) : (
            <>
              {/* Foiling picker */}
              <div className="flex flex-wrap gap-1 mt-2">
                {FOILING_ORDER.filter((f) => foilingPrices[f] !== undefined).map(
                  (f) => {
                    const isSelected = foiling === f;
                    const isAvailable = availableFoilings.includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() => isAvailable && onFoilingChange(key, f)}
                        title={FOILING_NAMES[f]}
                        className={`px-2 py-0.5 rounded text-xs font-mono font-medium border transition ${
                          isSelected
                            ? "bg-white text-gray-900 border-white"
                            : isAvailable
                            ? "border-gray-600 text-gray-300 hover:border-gray-400"
                            : "border-gray-800 text-gray-700 cursor-default"
                        }`}
                      >
                        {FOILING_LABELS[f] ?? f}{" "}
                        <span
                          className={
                            isSelected ? "text-gray-600" : "text-gray-500"
                          }
                        >
                          {formatCAD(foilingPrices[f])}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              {/* Per-retailer prices for selected foiling */}
              <div className="flex flex-wrap gap-2 mt-2">
                {retailers
                  .filter((r) => selectedRetailers.has(r.slug))
                  .map((r) => {
                    const opt = optionsForFoiling.find(
                      (o) => o.retailerSlug === r.slug
                    );
                    const isCheapest =
                      opt !== undefined && opt.price === cheapestPrice;
                    const color = RETAILER_COLORS[r.slug] ?? "#6b7280";
                    const editionLabel = opt?.edition
                      ? EDITION_LABELS[opt.edition] ?? ""
                      : "";
                    const rarityLabel = opt?.rarity
                      ? RARITY_LABELS[opt.rarity] ?? ""
                      : "";
                    const subtitle = [editionLabel, rarityLabel]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={r.slug}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                          opt
                            ? isCheapest
                              ? "border-transparent"
                              : "border-gray-700"
                            : "border-gray-800 opacity-40"
                        }`}
                        style={
                          opt && isCheapest
                            ? {
                                backgroundColor: `${color}22`,
                                borderColor: color,
                              }
                            : {}
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: opt ? color : "#4b5563" }}
                        />
                        <span
                          className={opt ? "text-gray-300" : "text-gray-600"}
                        >
                          {r.name}
                        </span>
                        {opt ? (
                          <>
                            <span
                              className="font-mono font-semibold"
                              style={{ color: isCheapest ? color : undefined }}
                            >
                              {formatCAD(opt.price)}
                            </span>
                            {subtitle && (
                              <span className="text-gray-600">{subtitle}</span>
                            )}
                            <a
                              href={opt.productUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-600 hover:text-gray-300 transition"
                              title="View product"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────
function ComparisonTable({
  data,
  selectedRetailers,
  foilingSelections,
}: {
  data: DeckCheckoutResponseV2;
  selectedRetailers: Set<string>;
  foilingSelections: Record<string, string>;
}) {
  const activeRetailers = data.retailers.filter((r) =>
    selectedRetailers.has(r.slug)
  );

  // Per-retailer: total if buying everything from that one shop
  const retailerStats = useMemo(() => {
    return activeRetailers.map((retailer) => {
      let total = 0;
      let found = 0;
      let missing = 0;
      const cartMap = new Map<string, number>();
      for (const result of data.results) {
        const key = cardKey(result);
        const foiling = foilingSelections[key] ?? "S";
        const opts = getOptionsForFoiling(
          result.options,
          foiling,
          new Set([retailer.slug])
        );
        if (opts.length > 0) {
          total += opts[0].price * result.input.qty;
          found++;
          cartMap.set(
            opts[0].variantId,
            (cartMap.get(opts[0].variantId) ?? 0) + result.input.qty
          );
        } else {
          missing++;
        }
      }
      return {
        slug: retailer.slug,
        name: retailer.name,
        total,
        found,
        missing,
        cartUrl: buildCartUrl(retailer.slug, cartMap),
      };
    });
  }, [data, activeRetailers, foilingSelections]);

  // Best split: cheapest per card across all selected retailers
  const bestSplit = useMemo(() => {
    let total = 0;
    let found = 0;
    let missing = 0;
    const retailerCartMaps: Record<string, Map<string, number>> = {};
    for (const result of data.results) {
      const key = cardKey(result);
      const foiling = foilingSelections[key] ?? "S";
      const opts = getOptionsForFoiling(result.options, foiling, selectedRetailers);
      if (opts.length > 0) {
        const cheapest = opts[0];
        total += cheapest.price * result.input.qty;
        found++;
        if (!retailerCartMaps[cheapest.retailerSlug])
          retailerCartMaps[cheapest.retailerSlug] = new Map();
        const map = retailerCartMaps[cheapest.retailerSlug];
        map.set(
          cheapest.variantId,
          (map.get(cheapest.variantId) ?? 0) + result.input.qty
        );
      } else {
        missing++;
      }
    }
    const cartUrls: Record<string, string> = {};
    for (const [slug, map] of Object.entries(retailerCartMaps)) {
      const url = buildCartUrl(slug, map);
      if (url) cartUrls[slug] = url;
    }
    return { total, found, missing, cartUrls };
  }, [data, selectedRetailers, foilingSelections]);

  if (activeRetailers.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Cart Comparison</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Totals assume buying every available card from a single shop
        </p>
      </div>

      <div className="divide-y divide-gray-800/60">
        {/* Per-retailer rows */}
        {retailerStats.map((r) => {
          const color = RETAILER_COLORS[r.slug] ?? "#6b7280";
          return (
            <div
              key={r.slug}
              className="flex items-center gap-4 px-4 py-3 flex-wrap"
            >
              <div className="flex items-center gap-2 w-28 shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium text-white">{r.name}</span>
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-4 text-sm">
                <span className="font-mono font-bold text-white">
                  {formatCAD(r.total)}
                </span>
                <span className="text-gray-500 text-xs">
                  {r.found}/{data.results.length} cards
                  {r.missing > 0 && (
                    <span className="text-yellow-600 ml-1">
                      ({r.missing} missing)
                    </span>
                  )}
                </span>
              </div>
              {r.cartUrl ? (
                <a
                  href={r.cartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition"
                  style={{ backgroundColor: color }}
                >
                  Shop at {r.name} →
                </a>
              ) : (
                <span className="shrink-0 text-xs text-gray-600">
                  No items available
                </span>
              )}
            </div>
          );
        })}

        {/* Best split row */}
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-800/40 flex-wrap">
          <div className="flex items-center gap-2 w-28 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
            <span className="text-sm font-medium text-yellow-300">
              Best Split
            </span>
          </div>
          <div className="flex-1 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-mono font-bold text-yellow-300">
              {formatCAD(bestSplit.total)}
            </span>
            <span className="text-gray-500 text-xs">
              {bestSplit.found}/{data.results.length} cards — cheapest per card
              {bestSplit.missing > 0 && (
                <span className="text-yellow-600 ml-1">
                  ({bestSplit.missing} missing)
                </span>
              )}
            </span>
          </div>
          {/* Cart links per retailer in best split */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {Object.entries(bestSplit.cartUrls).map(([slug, url]) => {
              const color = RETAILER_COLORS[slug] ?? "#6b7280";
              const name =
                data.retailers.find((r) => r.slug === slug)?.name ?? slug;
              return (
                <a
                  key={slug}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition opacity-90 hover:opacity-100"
                  style={{ backgroundColor: color }}
                >
                  {name} →
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DeckCheckoutPage() {
  const { status } = useSession();
  const [deckText, setDeckText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DeckCheckoutResponseV2 | null>(null);
  const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(
    new Set()
  );
  // Per-card foiling selection: cardKey → foiling code
  const [foilingSelections, setFoilingSelections] = useState<
    Record<string, string>
  >({});

  // Initialise selections whenever new results arrive
  useEffect(() => {
    if (!data) return;
    setSelectedRetailers(new Set(data.retailers.map((r) => r.slug)));
    const selections: Record<string, string> = {};
    for (const result of data.results) {
      const key = cardKey(result);
      const allRetailers = new Set(data.retailers.map((r) => r.slug));
      const available = getAvailableFoilings(result.options, allRetailers);
      selections[key] = available.includes("S") ? "S" : (available[0] ?? "S");
    }
    setFoilingSelections(selections);
  }, [data]);

  if (status === "unauthenticated") return <SignInPrompt />;
  if (status === "loading") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deckText.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/deck-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckList: deckText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Request failed"
        );
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function toggleRetailer(slug: string) {
    setSelectedRetailers((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  function setFoiling(key: string, foiling: string) {
    setFoilingSelections((prev) => ({ ...prev, [key]: foiling }));
  }

  const totalFound = data
    ? data.results.filter((r) => {
        const foiling = foilingSelections[cardKey(r)] ?? "S";
        return getOptionsForFoiling(r.options, foiling, selectedRetailers).length > 0;
      }).length
    : 0;
  const totalMissing = data ? data.results.length - totalFound : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Deck Checkout</h1>
        <p className="text-sm text-gray-400 mt-1">
          Paste a FaBrary deck list. Choose your shops and foiling, then compare
          cart totals.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={deckText}
          onChange={(e) => setDeckText(e.target.value)}
          placeholder={
            "Name: My Deck\nHero: Enigma\n\nDeck cards\n2x Brothers in Arms (red)\n1x Blade Beckoner Helm\n..."
          }
          className="w-full h-48 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y font-mono"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="submit"
            disabled={loading || !deckText.trim()}
            className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Finding prices…" : "Find Prices"}
          </button>
          {data && (
            <button
              type="button"
              onClick={() => {
                setData(null);
                setDeckText("");
              }}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-500 hover:text-white transition"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Controls bar: retailer toggles + summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-sm">
            <RetailerToggles
              retailers={data.retailers}
              selected={selectedRetailers}
              onToggle={toggleRetailer}
            />
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>
                <span className="font-semibold text-white">{totalFound}</span>
                /{data.results.length} available
              </span>
              {totalMissing > 0 && (
                <span className="text-yellow-500">
                  {totalMissing} missing
                </span>
              )}
            </div>
          </div>

          {/* Card list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {data.results.map((result) => (
              <CardRow
                key={cardKey(result)}
                result={result}
                selectedRetailers={selectedRetailers}
                foiling={foilingSelections[cardKey(result)] ?? "S"}
                onFoilingChange={setFoiling}
                retailers={data.retailers}
              />
            ))}
          </div>

          {/* Comparison table */}
          <ComparisonTable
            data={data}
            selectedRetailers={selectedRetailers}
            foilingSelections={foilingSelections}
          />
        </div>
      )}
    </div>
  );
}
