"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import type { PublicUser, PublicCollectionRow } from "@/lib/auth-queries";

const FOILING: Record<string, string> = {
  S: "Standard", R: "Rainbow Foil", C: "Cold Foil", G: "Gold Cold Foil",
};
const EDITION: Record<string, string> = {
  A: "Alpha", F: "1st Ed.", U: "Unlimited", N: "Normal",
};
const RARITY: Record<string, string> = {
  C: "Common", R: "Rare", S: "Super Rare", M: "Majestic",
  L: "Legendary", F: "Fabled", V: "Marvel", T: "Token", P: "Promo",
};
const RARITY_COLOR: Record<string, string> = {
  C: "text-gray-400", R: "text-blue-400", S: "text-purple-400",
  M: "text-yellow-400", L: "text-orange-400", F: "text-red-400",
  V: "text-pink-400", T: "text-gray-400", P: "text-teal-400",
};
const FOILING_COLOR: Record<string, string> = {
  S: "bg-gray-800 text-gray-400",
  R: "bg-indigo-950 text-indigo-300",
  C: "bg-sky-950 text-sky-300",
  G: "bg-yellow-950 text-yellow-300",
};

interface PageData {
  user: PublicUser;
  collection: PublicCollectionRow[];
}

function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-[5/7] bg-gray-800" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-800 rounded w-3/4" />
        <div className="h-2.5 bg-gray-800 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function PlayerCollectionPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [activeRarity, setActiveRarity] = useState("");
  const [activeFoiling, setActiveFoiling] = useState("");

  useEffect(() => {
    fetch(`/api/players/${userId}/collection`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return; }
        if (r.status === 403) { setFriendsOnly(true); setLoading(false); return; }
        const d = await r.json();
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const collection = data?.collection ?? [];

  const rarities = useMemo(() =>
    [...new Set(collection.map(c => c.rarity).filter(Boolean) as string[])].sort(),
  [collection]);

  const foilings = useMemo(() =>
    [...new Set(collection.map(c => c.foiling).filter(Boolean) as string[])].filter(f => f !== "S").sort(),
  [collection]);

  const filtered = useMemo(() => {
    let out = collection;
    const q = search.trim().toLowerCase();
    if (q) out = out.filter(c => c.card_name?.toLowerCase().includes(q));
    if (activeRarity) out = out.filter(c => c.rarity === activeRarity);
    if (activeFoiling) out = out.filter(c => c.foiling === activeFoiling);
    return out;
  }, [collection, search, activeRarity, activeFoiling]);

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-40 bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // ── Error states ──────────────────────────────────────────────
  if (friendsOnly) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Friends Only</h2>
        <p className="text-gray-500 text-sm mb-6">You need to be friends with this player to view their collection.</p>
        <Link href="/players" className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition">
          Go to Players
        </Link>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 mb-4">Collection not found or is private.</p>
        <Link href="/players" className="text-violet-400 hover:underline text-sm">← Back to Players</Link>
      </div>
    );
  }

  const { user } = data;
  const displayName = user.display_name ?? user.name ?? "Unknown Player";
  const isFiltered = !!(search || activeRarity || activeFoiling);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <Link href="/players" className="text-gray-500 hover:text-white transition text-sm flex items-center gap-1.5 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Players
        </Link>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-bold text-xl shrink-0">
            {displayName[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{displayName}&apos;s Collection</h1>
            <p className="text-xs text-gray-500">
              {collection.length} {collection.length === 1 ? "entry" : "entries"}
              {isFiltered && filtered.length !== collection.length && ` · showing ${filtered.length}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      {collection.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 text-sm transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Rarity chips */}
          {rarities.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {rarities.map(r => (
                <button key={r} onClick={() => setActiveRarity(activeRarity === r ? "" : r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    activeRarity === r
                      ? "bg-violet-600/20 border-violet-500/60 text-violet-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                  }`}
                >
                  {RARITY[r] ?? r}
                </button>
              ))}
            </div>
          )}

          {/* Foiling chips */}
          {foilings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {foilings.map(f => (
                <button key={f} onClick={() => setActiveFoiling(activeFoiling === f ? "" : f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    activeFoiling === f
                      ? "bg-violet-600/20 border-violet-500/60 text-violet-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                  }`}
                >
                  {FOILING[f] ?? f}
                </button>
              ))}
            </div>
          )}

          {isFiltered && (
            <button onClick={() => { setSearch(""); setActiveRarity(""); setActiveFoiling(""); }}
              className="text-xs text-red-400 hover:text-red-300 transition"
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Collection grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm">
          {isFiltered ? "No cards match your filters." : "This collection is empty."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((row, i) => (
            <Link
              key={`${row.printing_unique_id}-${i}`}
              href={`/cards/${row.printing_unique_id}`}
              className="group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl overflow-hidden transition"
            >
              {/* Card image */}
              <div className="relative aspect-[5/7] bg-gray-800 overflow-hidden">
                {row.image_url ? (
                  <CardImage
                    src={row.image_url}
                    alt={row.card_name ?? ""}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Qty badge */}
                {row.quantity > 1 && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded-md text-[10px] font-bold text-white">
                    ×{row.quantity}
                  </div>
                )}

                {/* Foiling badge */}
                {row.foiling && row.foiling !== "S" && (
                  <div className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${FOILING_COLOR[row.foiling] ?? "bg-gray-800 text-gray-400"}`}>
                    {FOILING[row.foiling] ?? row.foiling}
                  </div>
                )}
              </div>

              {/* Card info */}
              <div className="p-3">
                <p className="text-xs font-semibold text-white leading-tight line-clamp-2 group-hover:text-violet-300 transition">
                  {row.card_name ?? "Unknown"}
                </p>
                <div className="flex items-center justify-between mt-1.5 gap-1">
                  <span className="text-[10px] text-gray-600 truncate">
                    {row.set_name ?? row.set_id ?? "—"}
                    {row.edition && EDITION[row.edition] ? ` · ${EDITION[row.edition]}` : ""}
                  </span>
                  {row.rarity && (
                    <span className={`text-[10px] font-bold shrink-0 ${RARITY_COLOR[row.rarity] ?? "text-gray-400"}`}>
                      {RARITY[row.rarity] ?? row.rarity}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-500 font-medium">
                    {row.condition}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
