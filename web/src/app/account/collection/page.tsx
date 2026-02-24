"use client";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import CardFilters from "@/components/CardFilters";

// ── Label maps ────────────────────────────────────────────────────────────

const FOILING: Record<string, string> = {
  S: "Standard", R: "Rainbow Foil", C: "Cold Foil", G: "Gold Cold Foil",
};
const RARITY: Record<string, string> = {
  C: "Common", R: "Rare", S: "Super Rare", M: "Majestic",
  L: "Legendary", F: "Fabled", V: "Marvel",
};
const EDITION: Record<string, string> = {
  A: "Alpha", F: "First Ed.", U: "Unlimited", N: "Normal",
};
const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];

// ── Types ─────────────────────────────────────────────────────────────────

interface CollectionRow {
  id: string; printing_unique_id: string; card_name: string | null; card_id: string | null;
  set_name: string | null; set_id: string | null;
  rarity: string | null; foiling: string | null; edition: string | null;
  image_url: string | null; quantity: number; condition: string;
  acquired_price: number | null; notes: string | null;
}
interface PriceMap { [key: string]: number | undefined; }

type SortKey =
  | "name_asc" | "name_desc"
  | "price_asc" | "price_desc"
  | "value_asc" | "value_desc"
  | "pnl_desc" | "pnl_asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name_asc",   label: "Name A → Z" },
  { value: "name_desc",  label: "Name Z → A" },
  { value: "price_desc", label: "Price ↓ High first" },
  { value: "price_asc",  label: "Price ↑ Low first" },
  { value: "value_desc", label: "Value ↓ High first" },
  { value: "value_asc",  label: "Value ↑ Low first" },
  { value: "pnl_desc",   label: "P&L Best first" },
  { value: "pnl_asc",    label: "P&L Worst first" },
];

// ── Summary stat cell ─────────────────────────────────────────────────────

function Stat({
  label, value, sub, valueClass = "text-white", loading = false,
}: {
  label: string; value: string; sub?: string; valueClass?: string; loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[90px]">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      {loading ? (
        <div className="h-6 w-20 bg-gray-800 rounded animate-pulse mt-0.5" />
      ) : (
        <span className={`text-lg font-bold leading-tight ${valueClass}`}>{value}</span>
      )}
      {sub && !loading && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

// ── Outer page — provides Suspense boundary for useSearchParams ────────────

export default function CollectionPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="h-24 bg-gray-900 border border-gray-800 rounded-xl animate-pulse mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <CollectionPageInner />
    </Suspense>
  );
}

// ── Inner page — reads URL search params for filter state ─────────────────

function CollectionPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(false);

  // Sort is local state only (not URL-based)
  const [sort, setSort] = useState<SortKey>("name_asc");
  // Search stays local to avoid re-pushing URL on every keystroke
  const [search, setSearch] = useState("");

  // ── Data loading ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const data: CollectionRow[] = await fetch("/api/account/collection").then(r => r.json());
    setRows(data);
    setLoading(false);

    if (data.length > 0) {
      setPricesLoading(true);
      const ids = [...new Set(data.map(r => r.printing_unique_id))].join(",");
      fetch(`/api/collection/prices?ids=${encodeURIComponent(ids)}`)
        .then(r => r.json())
        .then(p => { setPrices(p); setPricesLoading(false); })
        .catch(() => setPricesLoading(false));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function remove(id: string) {
    await fetch(`/api/account/collection/${id}`, { method: "DELETE" });
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function updateQty(id: string, qty: number) {
    if (qty < 1) return;
    await fetch(`/api/account/collection/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: qty }),
    });
    setRows(prev => prev.map(r => r.id === id ? { ...r, quantity: qty } : r));
  }

  // ── Condition URL param helper ─────────────────────────────────────────

  function setConditionParam(val: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (val) p.set("condition", val); else p.delete("condition");
    p.delete("page");
    router.push(`/account/collection?${p.toString()}`);
  }

  // ── Collection-aware availability (for CardFilters graying) ───────────────
  // Values present in the user's collection — options not here get grayed out

  const collectionAvailable = useMemo(() => ({
    foiling: new Set(rows.map(r => r.foiling).filter((v): v is string => v !== null)),
    rarity:  new Set(rows.map(r => r.rarity ).filter((v): v is string => v !== null)),
    // set_id is the set_code — same values CardFilters uses for the set filter
    set:     new Set(rows.map(r => r.set_id ).filter((v): v is string => v !== null)),
    edition: new Set(rows.map(r => r.edition).filter((v): v is string => v !== null)),
  }), [rows]);

  // Condition options actually in the collection
  const conditionOptions = useMemo(() =>
    CONDITIONS.filter(c => rows.some(r => r.condition === c)),
  [rows]);

  // ── Active URL filter values (from CardFilters) ──────────────────────────

  const activeCondition = searchParams.get("condition") ?? "";
  const activeFoiling   = searchParams.get("foiling")   ?? "";
  const activeRarity    = searchParams.get("rarity")    ?? "";
  const activeSet       = searchParams.get("set")       ?? "";
  const activeEdition   = searchParams.get("edition")   ?? "";

  // ── Filtered + sorted rows ────────────────────────────────────────────────

  const visibleRows = useMemo(() => {
    let out = rows;

    const q = search.trim().toLowerCase();
    if (q)             out = out.filter(r => r.card_name?.toLowerCase().includes(q) || r.card_id?.toLowerCase().includes(q));
    if (activeFoiling) out = out.filter(r => r.foiling === activeFoiling);
    if (activeRarity)  out = out.filter(r => r.rarity  === activeRarity);
    if (activeSet)     out = out.filter(r => r.set_id  === activeSet);
    if (activeEdition) out = out.filter(r => r.edition === activeEdition);
    if (activeCondition) out = out.filter(r => r.condition === activeCondition);

    // Sort
    out = [...out].sort((a, b) => {
      const pa = prices[a.printing_unique_id];
      const pb = prices[b.printing_unique_id];
      const va = (pa ?? 0) * a.quantity;
      const vb = (pb ?? 0) * b.quantity;
      const pnlA = a.acquired_price != null && pa != null ? va - a.acquired_price * a.quantity : null;
      const pnlB = b.acquired_price != null && pb != null ? vb - b.acquired_price * b.quantity : null;

      switch (sort) {
        case "name_desc":  return (b.card_name ?? "").localeCompare(a.card_name ?? "");
        case "price_desc": return (pb ?? -1) - (pa ?? -1);
        case "price_asc":  return (pa ?? Infinity) - (pb ?? Infinity);
        case "value_desc": return vb - va;
        case "value_asc":  return va - vb;
        case "pnl_desc":   return (pnlB ?? -Infinity) - (pnlA ?? -Infinity);
        case "pnl_asc":    return (pnlA ?? Infinity) - (pnlB ?? Infinity);
        default:           return (a.card_name ?? "").localeCompare(b.card_name ?? "");
      }
    });

    return out;
  }, [rows, search, activeFoiling, activeRarity, activeSet, activeEdition, activeCondition, sort, prices]);

  // ── Totals for summary bar (visible rows only) ────────────────────────────

  const totalCards    = visibleRows.reduce((s, r) => s + r.quantity, 0);
  const uniquePrints  = visibleRows.length;
  const marketValue   = visibleRows.reduce((s, r) => s + (prices[r.printing_unique_id] ?? 0) * r.quantity, 0);
  const hasCostBasis  = visibleRows.some(r => r.acquired_price != null);
  const costBasis     = visibleRows.reduce((s, r) => s + (r.acquired_price ?? 0) * r.quantity, 0);
  const pnl           = marketValue - costBasis;
  const pricesResolved = !pricesLoading && Object.keys(prices).length > 0;

  const isFiltered = !!(search || activeFoiling || activeRarity || activeSet || activeEdition || activeCondition);

  function clearAll() {
    setSearch("");
    router.push("/account/collection");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">My Collection</h1>
        <Link
          href="/cards"
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
        >
          + Add Cards
        </Link>
      </div>

      {/* ── Summary bar ────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-4">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Stat
            label={isFiltered ? "Cards (filtered)" : "Cards"}
            value={loading ? "—" : String(totalCards)}
          />
          <Stat
            label={isFiltered ? "Printings (filtered)" : "Printings"}
            value={loading ? "—" : String(uniquePrints)}
          />
          <div className="hidden sm:block w-px bg-gray-800 self-stretch" />
          <Stat
            label="Market Value (NM)"
            value={pricesResolved ? `CA$${marketValue.toFixed(2)}` : "—"}
            loading={pricesLoading}
            valueClass="text-green-400"
          />
          <Stat
            label="Cost Basis"
            value={hasCostBasis ? `CA$${costBasis.toFixed(2)}` : "—"}
            sub={!hasCostBasis ? "add acquired prices" : undefined}
          />
          {hasCostBasis && pricesResolved && (
            <Stat
              label="P&L"
              value={`${pnl >= 0 ? "+" : ""}CA$${pnl.toFixed(2)}`}
              sub={marketValue > 0 ? `${pnl >= 0 ? "+" : ""}${((pnl / costBasis) * 100).toFixed(1)}%` : undefined}
              valueClass={pnl >= 0 ? "text-green-400" : "text-red-400"}
            />
          )}
        </div>
      </div>

      {/* ── Filter panel — only when data is loaded ───────────────────────── */}
      {!loading && rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 mb-4 space-y-4">

          {/* Search + Sort row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search (local state) */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search card name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">✕</button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-500 hidden sm:block">Sort</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* CardFilters — same component as card browse, with collection-aware graying */}
          <CardFilters
            basePath="/account/collection"
            collectionAvailable={collectionAvailable}
          />

          {/* Condition filter — collection-only, not part of CardFilters */}
          {conditionOptions.length > 1 && (
            <div>
              <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Condition
              </span>
              <div className="flex flex-wrap gap-1.5">
                {conditionOptions.map(c => (
                  <button
                    key={c}
                    onClick={() => setConditionParam(activeCondition === c ? null : c)}
                    className={
                      activeCondition === c
                        ? "px-2.5 py-1 rounded-md text-xs font-medium border bg-red-600/25 border-red-500/60 text-red-300 shadow-sm shadow-red-500/10"
                        : "px-2.5 py-1 rounded-md text-xs font-medium border bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-all duration-150"
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear all — when any filter is active */}
          {isFiltered && (
            <div className="pt-1 border-t border-gray-800">
              <button
                onClick={clearAll}
                className="text-xs text-red-400 hover:text-red-300 transition"
              >
                ✕ Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Collection list ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 font-medium">Your collection is empty</p>
          <p className="text-sm text-gray-600 mt-1">
            Browse cards and click <strong className="text-gray-400">&ldquo;+ Collection&rdquo;</strong> on any card page.
          </p>
          <Link
            href="/cards"
            className="mt-4 inline-block px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
          >
            Browse Cards
          </Link>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 font-medium">No cards match your filters</p>
          <button
            onClick={clearAll}
            className="mt-3 text-sm text-red-400 hover:text-red-300 transition"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map(row => {
            const currentPrice = prices[row.printing_unique_id];
            const currentValue = (currentPrice ?? 0) * row.quantity;
            const costValue    = (row.acquired_price ?? 0) * row.quantity;
            const pnlRow       = row.acquired_price != null && currentPrice != null
              ? currentValue - costValue
              : null;

            return (
              <div
                key={row.id}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition"
              >
                <div className="flex items-center gap-3 p-3">
                  <Link href={`/cards/${row.printing_unique_id}`} className="shrink-0">
                    <CardImage
                      src={row.image_url}
                      alt={row.card_name ?? ""}
                      width={48}
                      height={67}
                      className="rounded w-12 h-[67px] object-cover"
                    />
                  </Link>
                  <Link href={`/cards/${row.printing_unique_id}`} className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{row.card_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.card_id && (
                        <span className="text-[10px] font-mono text-gray-500">{row.card_id}</span>
                      )}
                      {row.set_name && (
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{row.set_name}</span>
                      )}
                      {row.edition && EDITION[row.edition] && (
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{EDITION[row.edition]}</span>
                      )}
                      {row.foiling && FOILING[row.foiling] && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${row.foiling !== "S" ? "bg-yellow-900/30 text-yellow-400" : "bg-gray-800 text-gray-400"}`}>
                          {FOILING[row.foiling]}
                        </span>
                      )}
                      {row.rarity && RARITY[row.rarity] && (
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{RARITY[row.rarity]}</span>
                      )}
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{row.condition}</span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Qty stepper */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(row.id, row.quantity - 1)}
                        className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm flex items-center justify-center transition"
                      >-</button>
                      <span className="w-8 text-center text-white text-sm font-semibold">{row.quantity}</span>
                      <button
                        onClick={() => updateQty(row.id, row.quantity + 1)}
                        className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm flex items-center justify-center transition"
                      >+</button>
                    </div>

                    {/* Per-row value + P&L */}
                    <div className="text-right hidden sm:block min-w-[80px]">
                      {pricesLoading ? (
                        <div className="h-4 w-16 bg-gray-800 rounded animate-pulse ml-auto" />
                      ) : (
                        <>
                          <p className="text-sm font-bold text-white">
                            {currentPrice != null ? `CA$${currentValue.toFixed(2)}` : "—"}
                          </p>
                          {currentPrice != null && (
                            <p className="text-[10px] text-gray-500">
                              CA${currentPrice.toFixed(2)} ea.
                            </p>
                          )}
                          {pnlRow != null && (
                            <p className={`text-xs font-medium ${pnlRow >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {pnlRow >= 0 ? "+" : ""}CA${pnlRow.toFixed(2)}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => remove(row.id)}
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
          })}

          {/* Footer count when filtered */}
          {isFiltered && (
            <p className="text-center text-xs text-gray-600 pt-2">
              Showing {visibleRows.length} of {rows.length} entries
            </p>
          )}
        </div>
      )}
    </div>
  );
}
