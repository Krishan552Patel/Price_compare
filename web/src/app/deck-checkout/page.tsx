"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import CardImage from "@/components/CardImage";
import type { DeckCheckoutResponse, DeckCheckoutResult } from "@/lib/types";

const FOILING_LABELS: Record<string, string> = {
  S: "NF", R: "RF", C: "CF", G: "GF",
};
const EDITION_LABELS: Record<string, string> = {
  A: "Alpha", F: "1st", U: "Unlim", N: "Normal",
};
const RETAILER_COLORS: Record<string, string> = {
  invasion: "#ef4444",
  gobelin: "#22c55e",
  etb: "#3b82f6",
};
const RETAILER_NAMES: Record<string, string> = {
  invasion: "Invasion",
  gobelin: "Gobelin",
  etb: "ETB",
};

function formatCAD(n: number) {
  return `CA$${n.toFixed(2)}`;
}

// ── Unauthenticated prompt ────────────────────────────────────────────────────
function SignInPrompt() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
        <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.874-7.148a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Deck Checkout</h1>
      <p className="text-gray-400 mb-6">Sign in to find the cheapest in-stock cards for your deck and get pre-filled Shopify cart links.</p>
      <Link
        href="/login?callbackUrl=/deck-checkout"
        className="inline-block px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition"
      >
        Sign In
      </Link>
    </div>
  );
}

// ── Retailer section ──────────────────────────────────────────────────────────
function RetailerSection({
  slug,
  cartUrl,
  items,
}: {
  slug: string;
  cartUrl: string;
  items: DeckCheckoutResult[];
}) {
  const color = RETAILER_COLORS[slug] || "#6b7280";
  const name = RETAILER_NAMES[slug] || slug;
  const subtotal = items.reduce(
    (sum, r) => sum + (r.match ? r.match.price * r.input.qty : 0),
    0
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-white">{name}</span>
          <span className="text-xs text-gray-500">{items.length} card{items.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-mono font-bold text-white">{formatCAD(subtotal)}</span>
          <a
            href={cartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition"
            style={{ backgroundColor: color }}
          >
            Shop at {name} →
          </a>
        </div>
      </div>

      {/* Card rows */}
      <div className="divide-y divide-gray-800/60">
        {items.map((r, i) => {
          const m = r.match!;
          const foilingLabel = m.foiling ? (FOILING_LABELS[m.foiling] ?? m.foiling) : "NF";
          const editionLabel = m.edition ? (EDITION_LABELS[m.edition] ?? m.edition) : "";
          const printingLabel = [editionLabel, foilingLabel].filter(Boolean).join(" ");
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Link href={`/cards/${m.cardUniqueId}`} className="shrink-0">
                <CardImage
                  src={m.imageUrl}
                  alt={m.cardName}
                  width={36}
                  height={50}
                  className="rounded w-9 h-[50px] object-cover"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/cards/${m.cardUniqueId}`}>
                  <p className="text-sm font-medium text-white truncate">{m.cardName}</p>
                </Link>
                <p className="text-xs text-gray-500">{printingLabel}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-gray-400">×{r.input.qty}</p>
                <p className="text-sm font-mono text-white">{formatCAD(m.price * r.input.qty)}</p>
                <p className="text-xs text-gray-600">{formatCAD(m.price)} ea</p>
              </div>
              <a
                href={m.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-gray-600 hover:text-gray-300 transition p-1"
                title="View product"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          );
        })}
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
  const [data, setData] = useState<DeckCheckoutResponse | null>(null);

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

  // Group found results by retailer
  const byRetailer: Record<string, DeckCheckoutResult[]> = {};
  const missing: DeckCheckoutResult[] = [];
  if (data) {
    for (const r of data.results) {
      if (r.match) {
        const slug = r.match.retailerSlug;
        (byRetailer[slug] = byRetailer[slug] ?? []).push(r);
      } else {
        missing.push(r);
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Deck Checkout</h1>
        <p className="text-sm text-gray-400 mt-1">
          Paste a FaBrary deck list to find the cheapest in-stock NM copy of each card and get direct cart links.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={deckText}
          onChange={(e) => setDeckText(e.target.value)}
          placeholder={"Name: My Deck\nHero: Enigma\n\nDeck cards\n2x Brothers in Arms (red)\n1x Blade Beckoner Helm\n..."}
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
              onClick={() => { setData(null); setDeckText(""); }}
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

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-sm">
            <div>
              <span className="text-gray-400">Found </span>
              <span className="font-semibold text-white">{data.totalFound}</span>
              <span className="text-gray-400"> / {data.totalFound + data.totalMissing} cards</span>
            </div>
            {data.totalMissing > 0 && (
              <div className="text-yellow-400">
                {data.totalMissing} card{data.totalMissing !== 1 ? "s" : ""} not in stock
              </div>
            )}
            <div className="ml-auto font-mono font-bold text-white">
              Total {formatCAD(data.grandTotal)}
            </div>
          </div>

          {/* Per-retailer sections */}
          {Object.entries(byRetailer).map(([slug, items]) => (
            <RetailerSection
              key={slug}
              slug={slug}
              cartUrl={data.cartUrls[slug] ?? "#"}
              items={items}
            />
          ))}

          {/* Not found */}
          {missing.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <span className="w-3 h-3 rounded-full bg-yellow-600 shrink-0" />
                <span className="font-semibold text-gray-300">Not in stock</span>
                <span className="text-xs text-gray-500">{missing.length} card{missing.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-gray-800/60">
                {missing.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-sm text-gray-300">{r.input.name}</p>
                      {r.input.pitch && (
                        <p className="text-xs text-gray-600">
                          {r.input.pitch === "1" ? "red" : r.input.pitch === "2" ? "yellow" : "blue"}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">×{r.input.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
