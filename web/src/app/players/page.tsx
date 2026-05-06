"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicUser } from "@/lib/auth-queries";

export default function PlayersPage() {
  const [players, setPlayers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((data) => { setPlayers(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Community Collections</h1>
        <p className="text-sm text-gray-400 mt-1">
          Browse public collections from other players. See what cards they own and ask in person to borrow.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : players.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          No public collections yet.{" "}
          <Link href="/account" className="text-blue-400 hover:underline">
            Make yours public in Account settings.
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {players.map((p) => {
            const displayName = p.display_name ?? p.name ?? "Unknown Player";
            return (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-700 to-purple-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {displayName[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate group-hover:text-blue-300 transition-colors">
                      {displayName}
                    </div>
                    <div className="text-xs text-gray-500">View collection →</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-xl text-sm text-gray-400">
        <span className="font-medium text-gray-300">Want to appear here?</span>{" "}
        Go to{" "}
        <Link href="/account" className="text-blue-400 hover:underline">
          Account Settings
        </Link>{" "}
        and enable &ldquo;Public Collection&rdquo;. Other players can then browse your collection to see what you own.
      </div>
    </div>
  );
}
