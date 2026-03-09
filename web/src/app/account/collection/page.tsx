"use client";
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
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

  // ── CSV Import state ──────────────────────────────────────────────────────
  type ImportRow = {
    printingUniqueId: string; cardName: string;
    quantity: number; condition: string;
    acquiredPrice: number | null; notes: string | null;
  };
  const importRef = useRef<HTMLInputElement>(null);
  const [importModal, setImportModal] = useState<"preview" | "importing" | "done" | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; reason: string }[] } | null>(null);

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

  // ── CSV Export ────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ["printing_unique_id","card_name","card_id","set_id","edition","foiling","rarity","quantity","condition","acquired_price","notes"];
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push([
        esc(row.printing_unique_id), esc(row.card_name), esc(row.card_id),
        esc(row.set_id), esc(row.edition), esc(row.foiling), esc(row.rarity),
        esc(row.quantity), esc(row.condition), esc(row.acquired_price), esc(row.notes),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `k-cards-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── CSV Import ────────────────────────────────────────────────────────────

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) { alert("CSV is empty or has no data rows."); return; }
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const pidIdx   = headers.indexOf("printing_unique_id");
      const nameIdx  = headers.indexOf("card_name");
      const qtyIdx   = headers.indexOf("quantity");
      const condIdx  = headers.indexOf("condition");
      const priceIdx = headers.indexOf("acquired_price");
      const notesIdx = headers.indexOf("notes");
      if (pidIdx === -1) { alert("CSV must have a 'printing_unique_id' column."); return; }
      const parsed: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const pid = cols[pidIdx];
        if (!pid) continue;
        const cond = condIdx >= 0 ? cols[condIdx] : "";
        parsed.push({
          printingUniqueId: pid,
          cardName: nameIdx >= 0 ? (cols[nameIdx] || "") : "",
          quantity: Math.max(1, parseInt(cols[qtyIdx] || "1", 10) || 1),
          condition: ["NM","LP","MP","HP","DMG"].includes(cond) ? cond : "NM",
          acquiredPrice: priceIdx >= 0 && cols[priceIdx] ? parseFloat(cols[priceIdx]) || null : null,
          notes: notesIdx >= 0 ? cols[notesIdx] || null : null,
        });
      }
      if (!parsed.length) { alert("No valid rows found in CSV."); return; }
      setImportRows(parsed);
      setImportResult(null);
      setImportModal("preview");
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    setImportModal("importing");
    const res = await fetch("/api/account/collection/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: importRows }),
    });
    const data = await res.json();
    setImportResult(data);
    setImportModal("done");
    if (data.imported > 0) load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">My Collection</h1>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button
              onClick={exportCSV}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium transition"
            >
              ↓ Export CSV
            </button>
          )}
          <button
            onClick={() => importRef.current?.click()}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium transition"
          >
            ↑ Import CSV
          </button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          <Link
            href="/cards"
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
          >
            + Add Cards
          </Link>
        </div>
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

      {/* ── Import Modal ────────────────────────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">

            {importModal === "preview" && (
              <>
                <div className="px-5 py-4 border-b border-gray-800">
                  <h2 className="text-lg font-bold text-white">Import CSV</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Found <span className="text-white font-semibold">{importRows.length}</span> card{importRows.length !== 1 ? "s" : ""} — quantities will be added to existing entries.
                  </p>
                </div>
                <div className="px-5 py-3 max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="text-left pb-2 font-medium">Card</th>
                        <th className="text-center pb-2 font-medium">Qty</th>
                        <th className="text-center pb-2 font-medium">Cond</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="py-1.5 text-gray-300 truncate max-w-[220px]">
                            {r.cardName || r.printingUniqueId}
                          </td>
                          <td className="py-1.5 text-center text-white font-semibold">{r.quantity}</td>
                          <td className="py-1.5 text-center text-gray-400">{r.condition}</td>
                        </tr>
                      ))}
                      {importRows.length > 10 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-gray-600 text-xs">
                            …and {importRows.length - 10} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-gray-800 flex gap-2 justify-end">
                  <button
                    onClick={() => setImportModal(null)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmImport}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition"
                  >
                    Import {importRows.length} card{importRows.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </>
            )}

            {importModal === "importing" && (
              <div className="px-5 py-10 text-center">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Importing cards…</p>
              </div>
            )}

            {importModal === "done" && importResult && (
              <>
                <div className="px-5 py-4 border-b border-gray-800">
                  <h2 className="text-lg font-bold text-white">Import Complete</h2>
                </div>
                <div className="px-5 py-4 space-y-2">
                  <p className="text-sm text-green-400 font-medium">
                    ✓ {importResult.imported} card{importResult.imported !== 1 ? "s" : ""} imported successfully
                  </p>
                  {importResult.errors.length > 0 && (
                    <div>
                      <p className="text-sm text-red-400 font-medium mb-1">
                        ✕ {importResult.errors.length} row{importResult.errors.length !== 1 ? "s" : ""} failed
                      </p>
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {importResult.errors.map((e, i) => (
                          <p key={i} className="text-xs text-gray-500">Row {e.row}: {e.reason}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 border-t border-gray-800 flex justify-end">
                  <button
                    onClick={() => setImportModal(null)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    Close
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
