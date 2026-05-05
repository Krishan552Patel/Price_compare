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

// ── Constants ─────────────────────────────────────────────────────────────────
const FOILING_LABELS: Record<string, string> = { S: "NF", R: "RF", C: "CF", G: "GF" };
const FOILING_NAMES: Record<string, string> = {
  S: "Standard", R: "Rainbow Foil", C: "Cold Foil", G: "Gold Cold Foil",
};
const FOILING_ORDER = ["S", "R", "C", "G"];
const RETAILER_COLORS: Record<string, string> = {
  invasion: "#ef4444", gobelin: "#22c55e", etb: "#3b82f6",
};
const RETAILER_DOMAINS: Record<string, string> = {
  invasion: "https://invasioncnc.ca",
  gobelin: "https://gobelindargent.ca",
  etb: "https://enterthebattlefield.ca",
};

function formatCAD(n: number) { return `CA$${n.toFixed(2)}`; }
function cardKey(r: DeckCheckoutResultV2) {
  return `${r.input.name.toLowerCase()}|${r.input.pitch ?? ""}`;
}
function pitchLabel(pitch: string | null) {
  return pitch === "1" ? "red" : pitch === "2" ? "yellow" : pitch === "3" ? "blue" : null;
}

// All foiling codes available for a card across selected retailers
function getAvailableFoilings(options: DeckCardOption[], selected: Set<string>): string[] {
  const found = new Set(
    options.filter(o => selected.has(o.retailerSlug)).map(o => o.foiling ?? "S")
  );
  return FOILING_ORDER.filter(f => found.has(f));
}

// Cheapest option for a card at a specific foiling, within a set of retailers
function cheapestFor(
  options: DeckCardOption[],
  foiling: string,
  retailers: Set<string>
): DeckCardOption | null {
  return (
    options
      .filter(o => (o.foiling ?? "S") === foiling && retailers.has(o.retailerSlug))
      .sort((a, b) => a.price - b.price)[0] ?? null
  );
}

// Parse the trailing number from a card_id like "WTR001" → 1
function parseCardNum(cardId: string | null): number {
  if (!cardId) return 9999;
  const m = cardId.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 9999;
}

// Sort cards by set code then by card number within that set.
// Uses the cheapest option for the given retailer+foiling as the sort key.
function sortBySetAndNumber(
  results: DeckCheckoutResultV2[],
  getOpt: (r: DeckCheckoutResultV2) => DeckCardOption | null
): DeckCheckoutResultV2[] {
  return [...results].sort((a, b) => {
    const ao = getOpt(a);
    const bo = getOpt(b);
    const aSet = ao?.setId ?? "";
    const bSet = bo?.setId ?? "";
    if (aSet !== bSet) return aSet.localeCompare(bSet);
    return parseCardNum(ao?.cardId ?? null) - parseCardNum(bo?.cardId ?? null);
  });
}

function buildCartUrl(slug: string, map: Map<string, number>): string | null {
  const domain = RETAILER_DOMAINS[slug];
  if (!domain || map.size === 0) return null;
  return `${domain}/cart/${Array.from(map.entries()).map(([v, q]) => `${v}:${q}`).join(",")}`;
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
        Sign in to compare prices across shops, pick your foiling, and get direct cart links.
      </p>
      <Link href="/login?callbackUrl=/deck-checkout"
        className="inline-block px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition">
        Sign In
      </Link>
    </div>
  );
}

// ── Shop toggles ──────────────────────────────────────────────────────────────
function ShopToggles({
  retailers, selected, onToggle,
}: {
  retailers: { slug: string; name: string }[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">Shops:</span>
      {retailers.map(r => {
        const on = selected.has(r.slug);
        const color = RETAILER_COLORS[r.slug] ?? "#6b7280";
        return (
          <button key={r.slug} onClick={() => onToggle(r.slug)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
              on ? "text-white border-transparent" : "text-gray-500 border-gray-700 bg-transparent"
            }`}
            style={on ? { backgroundColor: color } : {}}>
            <span className="w-2 h-2 rounded-full"
              style={{ backgroundColor: on ? "rgba(255,255,255,0.5)" : color }} />
            {r.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Card row inside a split section ──────────────────────────────────────────
function CardRow({
  result, sectionSlug, selectedRetailers, foiling, onFoilingChange,
}: {
  result: DeckCheckoutResultV2;
  sectionSlug: string;
  selectedRetailers: Set<string>;
  foiling: string;
  onFoilingChange: (key: string, f: string) => void;
}) {
  const key = cardKey(result);
  const availFoilings = getAvailableFoilings(result.options, selectedRetailers);
  const bestOpt = cheapestFor(result.options, foiling, new Set([sectionSlug]));
  const pitch = pitchLabel(result.input.pitch);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {/* Card thumbnail */}
      <Link href={result.cardUniqueId ? `/cards/${result.cardUniqueId}` : "#"} className="shrink-0">
        <CardImage
          src={result.imageUrl} alt={result.cardName ?? result.input.name}
          width={36} height={50} className="rounded w-9 h-[50px] object-cover" />
      </Link>

      {/* Name + foiling picker */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={result.cardUniqueId ? `/cards/${result.cardUniqueId}` : "#"}>
            <span className="text-sm font-medium text-white">{result.cardName ?? result.input.name}</span>
          </Link>
          {pitch && <span className="text-xs text-gray-600">{pitch}</span>}
        </div>
        {/* Foiling pills — only shown when multiple options exist */}
        {availFoilings.length > 1 && (
          <div className="flex gap-1 mt-1.5">
            {availFoilings.map(f => (
              <button key={f} onClick={() => onFoilingChange(key, f)}
                title={FOILING_NAMES[f]}
                className={`px-1.5 py-0.5 rounded text-xs font-mono border transition ${
                  foiling === f
                    ? "bg-white text-gray-900 border-white"
                    : "border-gray-700 text-gray-500 hover:border-gray-400 hover:text-gray-300"
                }`}>
                {FOILING_LABELS[f] ?? f}
              </button>
            ))}
          </div>
        )}
        {/* Single foiling badge — shown when only one option exists */}
        {availFoilings.length === 1 && foiling !== "S" && (
          <span className="mt-1 inline-block text-xs text-gray-500">
            {FOILING_NAMES[foiling] ?? foiling}
          </span>
        )}
      </div>

      {/* Price + qty */}
      <div className="shrink-0 text-right">
        <p className="text-xs text-gray-500">×{result.input.qty}</p>
        {bestOpt ? (
          <>
            <p className="text-sm font-mono font-semibold text-white">
              {formatCAD(bestOpt.price * result.input.qty)}
            </p>
            {result.input.qty > 1 && (
              <p className="text-xs text-gray-600">{formatCAD(bestOpt.price)} ea</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-600">—</p>
        )}
      </div>

      {/* Product link */}
      {bestOpt && (
        <a href={bestOpt.productUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-gray-600 hover:text-gray-300 transition p-1" title="View product">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

// ── Split section (one per retailer in the best split) ────────────────────────
function SplitSection({
  optionNumber, showOptionLabel, slug, name, results, total, cartUrl,
  selectedRetailers, foilingSelections, onFoilingChange,
}: {
  optionNumber: number;
  showOptionLabel: boolean;
  slug: string;
  name: string;
  results: DeckCheckoutResultV2[];
  total: number;
  cartUrl: string | null;
  selectedRetailers: Set<string>;
  foilingSelections: Record<string, string>;
  onFoilingChange: (key: string, f: string) => void;
}) {
  const color = RETAILER_COLORS[slug] ?? "#6b7280";

  const sorted = sortBySetAndNumber(results, (r) =>
    cheapestFor(r.options, foilingSelections[cardKey(r)] ?? "S", new Set([slug]))
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-800 flex-wrap">
        <div className="flex items-center gap-2">
          {showOptionLabel && (
            <span className="text-xs font-bold text-gray-500 tracking-wider">
              OPTION {optionNumber}
            </span>
          )}
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-white">{name}</span>
          <span className="text-xs text-gray-500">
            {results.length} card{results.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono font-bold text-white">{formatCAD(total)}</span>
          {cartUrl && (
            <a href={cartUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: color }}>
              Add to cart →
            </a>
          )}
        </div>
      </div>

      {/* Card rows — sorted by set then card number */}
      <div className="divide-y divide-gray-800/50">
        {sorted.map(result => (
          <CardRow
            key={cardKey(result)}
            result={result}
            sectionSlug={slug}
            selectedRetailers={selectedRetailers}
            foiling={foilingSelections[cardKey(result)] ?? "S"}
            onFoilingChange={onFoilingChange}
          />
        ))}
      </div>
    </div>
  );
}

// ── Not available section ─────────────────────────────────────────────────────
function MissingSection({
  results, selectedRetailers, allRetailers,
}: {
  results: DeckCheckoutResultV2[];
  selectedRetailers: Set<string>;
  allRetailers: { slug: string; name: string }[];
}) {
  if (results.length === 0) return null;

  const singleStore =
    selectedRetailers.size === 1
      ? allRetailers.find(r => selectedRetailers.has(r.slug))?.name
      : null;

  // Sort missing cards by set + card number using whatever options exist
  const sorted = sortBySetAndNumber(results, (r) => r.options[0] ?? null);

  return (
    <div className="bg-gray-900 border border-yellow-900/40 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-yellow-900/40">
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-600 shrink-0" />
        <span className="font-semibold text-yellow-400">
          {singleStore ? `Not available at ${singleStore}` : "Not available"}
        </span>
        <span className="text-xs text-gray-500">
          {results.length} card{results.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="divide-y divide-gray-800/40">
        {sorted.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-sm text-gray-400">{r.input.name}</p>
              {r.input.pitch && (
                <p className="text-xs text-gray-600">{pitchLabel(r.input.pitch)}</p>
              )}
            </div>
            <span className="text-xs text-gray-600">×{r.input.qty}</span>
          </div>
        ))}
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
  const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(new Set());
  const [foilingSelections, setFoilingSelections] = useState<Record<string, string>>({});

  // Initialise selections when results arrive
  useEffect(() => {
    if (!data) return;
    setSelectedRetailers(new Set(data.retailers.map(r => r.slug)));
    const all = new Set(data.retailers.map(r => r.slug));
    const init: Record<string, string> = {};
    for (const result of data.results) {
      const key = cardKey(result);
      const avail = getAvailableFoilings(result.options, all);
      init[key] = avail.includes("S") ? "S" : (avail[0] ?? "S");
    }
    setFoilingSelections(init);
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
        throw new Error((err as { error?: string }).error ?? "Request failed");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function toggleRetailer(slug: string) {
    setSelectedRetailers(prev => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  function setFoiling(key: string, f: string) {
    setFoilingSelections(prev => ({ ...prev, [key]: f }));
  }

  // Compute best split: group each card by its cheapest retailer
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const split = useMemo(() => {
    if (!data) return null;

    const groups: Record<string, DeckCheckoutResultV2[]> = {};
    const missing: DeckCheckoutResultV2[] = [];

    for (const result of data.results) {
      const key = cardKey(result);
      const foiling = foilingSelections[key] ?? "S";
      const best = cheapestFor(result.options, foiling, selectedRetailers);
      if (best) {
        (groups[best.retailerSlug] = groups[best.retailerSlug] ?? []).push(result);
      } else {
        missing.push(result);
      }
    }

    // Build per-retailer totals and cart URLs
    const sections = Object.entries(groups)
      .map(([slug, results]) => {
        let total = 0;
        const cartMap = new Map<string, number>();
        for (const r of results) {
          const foiling = foilingSelections[cardKey(r)] ?? "S";
          const opt = cheapestFor(r.options, foiling, new Set([slug]));
          if (opt) {
            total += opt.price * r.input.qty;
            cartMap.set(opt.variantId, (cartMap.get(opt.variantId) ?? 0) + r.input.qty);
          }
        }
        const name = data.retailers.find(r => r.slug === slug)?.name ?? slug;
        return { slug, name, results, total, cartUrl: buildCartUrl(slug, cartMap) };
      })
      .sort((a, b) => b.results.length - a.results.length); // most cards first = Option 1

    const grandTotal = sections.reduce((s, r) => s + r.total, 0);
    const totalFound = data.results.length - missing.length;

    return { sections, missing, grandTotal, totalFound };
  }, [data, selectedRetailers, foilingSelections]);

  const showOptionLabels = (split?.sections.length ?? 0) > 1;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Deck Checkout</h1>
        <p className="text-sm text-gray-400 mt-1">
          Paste your FaBrary deck list, choose your shops, and get the cheapest cart per store.
        </p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={deckText}
          onChange={e => setDeckText(e.target.value)}
          placeholder={"Name: My Deck\nHero: Enigma\n\nDeck cards\n2x Brothers in Arms (red)\n1x Blade Beckoner Helm\n..."}
          className="w-full h-48 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y font-mono"
        />
        <div className="flex items-center gap-3 mt-3">
          <button type="submit" disabled={loading || !deckText.trim()}
            className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {loading ? "Finding prices…" : "Find Prices"}
          </button>
          {data && (
            <button type="button" onClick={() => { setData(null); setDeckText(""); }}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-500 hover:text-white transition">
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

      {data && split && (
        <div className="space-y-4">
          {/* Controls + summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 space-y-3">
            <ShopToggles retailers={data.retailers} selected={selectedRetailers} onToggle={toggleRetailer} />
            <div className="flex items-center justify-between text-sm border-t border-gray-800 pt-3">
              <div className="flex items-center gap-3 text-gray-400">
                <span>
                  <span className="font-semibold text-white">{split.totalFound}</span>
                  <span> / {data.results.length} cards available</span>
                </span>
                {split.missing.length > 0 && (
                  <span className="text-yellow-500">
                    {split.missing.length} not found
                  </span>
                )}
              </div>
              {split.sections.length > 0 && (
                <div className="text-right">
                  {showOptionLabels && (
                    <p className="text-xs text-gray-500 mb-0.5">Best split total</p>
                  )}
                  <p className="font-mono font-bold text-white text-lg">
                    {formatCAD(split.grandTotal)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Per-retailer option sections */}
          {split.sections.map((section, i) => (
            <SplitSection
              key={section.slug}
              optionNumber={i + 1}
              showOptionLabel={showOptionLabels}
              slug={section.slug}
              name={section.name}
              results={section.results}
              total={section.total}
              cartUrl={section.cartUrl}
              selectedRetailers={selectedRetailers}
              foilingSelections={foilingSelections}
              onFoilingChange={setFoiling}
            />
          ))}

          {/* Not available */}
          <MissingSection
            results={split.missing}
            selectedRetailers={selectedRetailers}
            allRetailers={data.retailers}
          />
        </div>
      )}
    </div>
  );
}
