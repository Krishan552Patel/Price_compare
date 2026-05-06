"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import type { PublicUser, PublicCollectionRow } from "@/lib/auth-queries";

const FOILING_LABEL: Record<string, string> = {
  S: "Standard", R: "Rainbow Foil", C: "Cold Foil", G: "Gold Cold Foil",
};
const EDITION_LABEL: Record<string, string> = {
  A: "Alpha", F: "1st", U: "Unlimited", N: "Normal",
};
const RARITY_LABEL: Record<string, string> = {
  C: "Common", R: "Rare", S: "Super Rare", M: "Majestic",
  L: "Legendary", F: "Fabled", V: "Marvel", T: "Token", P: "Promo",
};
const CONDITION_LABEL: Record<string, string> = {
  NM: "NM", LP: "LP", MP: "MP", HP: "HP", DMG: "DMG",
};

interface PageData {
  user: PublicUser;
  collection: PublicCollectionRow[];
}

export default function PlayerCollectionPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/players/${userId}/collection`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return; }
        const d = await r.json();
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-20 text-center text-gray-400 text-sm">Loading…</div>;
  }

  if (notFound || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400 mb-4">Collection not found or is private.</p>
        <Link href="/players" className="text-blue-400 hover:underline text-sm">← Back to Players</Link>
      </div>
    );
  }

  const { user, collection } = data;
  const displayName = user.display_name ?? user.name ?? "Unknown Player";

  const filtered = search.trim()
    ? collection.filter((c) => c.card_name?.toLowerCase().includes(search.toLowerCase()))
    : collection;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/players" className="text-gray-400 hover:text-white text-sm transition-colors">← Players</Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-700 to-purple-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {displayName[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{displayName}&apos;s Collection</h1>
            <p className="text-xs text-gray-400">{collection.length} entries</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter by card name…"
        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
      />

      {/* Collection grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">
          {search ? "No cards match your search." : "This collection is empty."}
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <div>Card</div>
            <div>Set</div>
            <div>Edition</div>
            <div>Foiling</div>
            <div>Rarity</div>
            <div>Qty / Cond.</div>
          </div>
          {filtered.map((row, i) => (
            <div
              key={`${row.printing_unique_id}-${i}`}
              className="grid grid-cols-1 sm:grid-cols-[3fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-800">
                  {row.image_url ? (
                    <CardImage src={row.image_url} alt={row.card_name ?? ""} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">?</div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{row.card_name ?? "—"}</div>
                  <div className="text-xs text-gray-500 sm:hidden">
                    {row.set_name ?? row.set_id ?? "—"} · {CONDITION_LABEL[row.condition] ?? row.condition}
                  </div>
                </div>
              </div>
              <div className="hidden sm:block text-xs text-gray-400">{row.set_name ?? row.set_id ?? "—"}</div>
              <div className="hidden sm:block text-xs text-gray-400">{row.edition ? (EDITION_LABEL[row.edition] ?? row.edition) : "—"}</div>
              <div className="hidden sm:block text-xs text-gray-400">{row.foiling ? (FOILING_LABEL[row.foiling] ?? row.foiling) : "—"}</div>
              <div className="hidden sm:block text-xs text-gray-400">{row.rarity ? (RARITY_LABEL[row.rarity] ?? row.rarity) : "—"}</div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
                <span className="font-medium text-white">×{row.quantity}</span>
                <span className="px-1.5 py-0.5 rounded bg-gray-800">{CONDITION_LABEL[row.condition] ?? row.condition}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
