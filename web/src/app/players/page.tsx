"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { PublicUser } from "@/lib/auth-queries";

type FriendStatus = "none" | "pending_sent" | "pending_received" | "accepted";

interface PlayerCard extends PublicUser {
  friendship_id: string | null;
  status: FriendStatus;
}

interface FriendsData {
  friends: { friendship_id: string; id: string; display_name: string | null; name: string | null }[];
  pendingSent: { friendship_id: string; id: string; display_name: string | null; name: string | null }[];
  pendingReceived: { friendship_id: string; id: string; display_name: string | null; name: string | null }[];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-14 h-14 text-2xl" : "w-10 h-10 text-lg";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-bold shrink-0`}>
      {name[0].toUpperCase()}
    </div>
  );
}

export default function PlayersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerCard[]>([]);
  const [friendsData, setFriendsData] = useState<FriendsData>({ friends: [], pendingSent: [], pendingReceived: [] });
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [tab, setTab] = useState<"friends" | "find">("friends");

  const loadFriends = useCallback(async () => {
    const res = await fetch("/api/friends").then(r => r.json()).catch(() => null);
    if (res) setFriendsData(res);
    return res as FriendsData | null;
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  function buildStatusMap(fd: FriendsData) {
    const map = new Map<string, { status: FriendStatus; friendship_id: string | null }>();
    for (const f of fd.friends) map.set(f.id, { status: "accepted", friendship_id: f.friendship_id });
    for (const f of fd.pendingSent) map.set(f.id, { status: "pending_sent", friendship_id: f.friendship_id });
    for (const f of fd.pendingReceived) map.set(f.id, { status: "pending_received", friendship_id: f.friendship_id });
    return map;
  }

  function mergeStatus(players: PublicUser[], fd: FriendsData): PlayerCard[] {
    const map = buildStatusMap(fd);
    return players.map(p => ({
      ...p,
      status: map.get(p.id)?.status ?? "none",
      friendship_id: map.get(p.id)?.friendship_id ?? null,
    }));
  }

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearched(false);
    const players: PublicUser[] = await fetch(`/api/players?q=${encodeURIComponent(trimmed)}`).then(r => r.json()).catch(() => []);
    setResults(mergeStatus(players, friendsData));
    setSearched(true);
    setSearching(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runSearch(query);
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  async function withAction(key: string, fn: () => Promise<void>) {
    setActing(key);
    await fn();
    const fd = await loadFriends();
    if (fd) setResults(prev => mergeStatus(prev.map(p => ({ id: p.id, display_name: p.display_name, name: p.name })), fd));
    setActing(null);
  }

  const sendRequest = (userId: string) => withAction(userId, () =>
    fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }).then(() => {})
  );
  const respondToRequest = (friendshipId: string, action: "accept" | "reject") => withAction(friendshipId, () =>
    fetch(`/api/friends/${friendshipId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then(() => {})
  );
  const cancelOrUnfriend = (friendshipId: string) => withAction(friendshipId, () =>
    fetch(`/api/friends/${friendshipId}`, { method: "DELETE" }).then(() => {})
  );

  const { friends, pendingSent, pendingReceived } = friendsData;
  const hasFriends = friends.length > 0 || pendingSent.length > 0 || pendingReceived.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Players</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your friends and browse their collections.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
        <button
          onClick={() => setTab("friends")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === "friends" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          Friends
          {pendingReceived.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-[10px] text-white font-bold">
              {pendingReceived.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("find")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === "find" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          Find a Player
        </button>
      </div>

      {/* ── FRIENDS TAB ── */}
      {tab === "friends" && (
        <div className="space-y-6">

          {/* Incoming requests */}
          {pendingReceived.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Incoming Requests</h2>
              <div className="space-y-2">
                {pendingReceived.map(p => {
                  const name = p.display_name ?? p.name ?? "Unknown Player";
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-900 border border-violet-800/40 rounded-xl px-4 py-3">
                      <Avatar name={name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{name}</p>
                        <p className="text-[11px] text-gray-500 font-mono truncate">{p.id}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => respondToRequest(p.friendship_id, "accept")} disabled={acting === p.friendship_id}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition">
                          Accept
                        </button>
                        <button onClick={() => respondToRequest(p.friendship_id, "reject")} disabled={acting === p.friendship_id}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 rounded-lg text-xs transition">
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending sent */}
          {pendingSent.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Sent Requests</h2>
              <div className="space-y-2">
                {pendingSent.map(p => {
                  const name = p.display_name ?? p.name ?? "Unknown Player";
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <Avatar name={name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{name}</p>
                        <p className="text-[11px] text-gray-600 mt-0.5">Waiting for response…</p>
                      </div>
                      <button onClick={() => cancelOrUnfriend(p.friendship_id)} disabled={acting === p.friendship_id}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-500 hover:text-red-400 rounded-lg text-xs transition">
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accepted friends */}
          {friends.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Friends — {friends.length}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {friends.map(p => {
                  const name = p.display_name ?? p.name ?? "Unknown Player";
                  return (
                    <div key={p.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition group">
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar name={name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white truncate group-hover:text-violet-300 transition">{name}</p>
                          <p className="text-[10px] font-mono text-gray-600 truncate">{p.id}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/players/${p.id}`}
                          className="flex-1 text-center py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition">
                          View Collection
                        </Link>
                        <button onClick={() => cancelOrUnfriend(p.friendship_id)} disabled={acting === p.friendship_id}
                          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-500 hover:text-red-400 rounded-lg text-xs transition"
                          title="Unfriend">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasFriends && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-white font-semibold mb-1">No friends yet</p>
              <p className="text-gray-500 text-sm mb-5">Search for a player by name or ID to add them.</p>
              <button onClick={() => setTab("find")}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition">
                Find a Player
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FIND TAB ── */}
      {tab === "find" && (
        <div className="space-y-5">

          {/* Search box + button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); if (searched) { setSearched(false); setResults([]); } }}
                onKeyDown={handleKeyDown}
                placeholder="Name or Player ID…"
                className="w-full bg-gray-900 border border-gray-700 focus:border-violet-600 rounded-xl pl-11 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-600 text-sm transition"
              />
              {query && (
                <button onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={() => runSearch(query)}
              disabled={!query.trim() || searching}
              className="px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition"
            >
              {searching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : "Search"}
            </button>
          </div>

          {/* Hint */}
          {!searched && !searching && (
            <div className="flex items-start gap-3 p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <svg className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-400">
                Ask your friend to share their <span className="text-gray-200 font-medium">Player ID</span> from{" "}
                <Link href="/account" className="text-violet-400 hover:underline">Account Settings</Link>.
                You can also search by display name if they have Public Collection enabled.
              </p>
            </div>
          )}

          {/* No results */}
          {!searching && searched && results.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 font-medium">No players found</p>
              <p className="text-gray-600 text-sm mt-1">Double-check the name or ID and try again.</p>
            </div>
          )}

          {/* Results */}
          {!searching && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 px-1">{results.length} result{results.length !== 1 ? "s" : ""}</p>
              {results.map(p => {
                const displayName = p.display_name ?? p.name ?? "Unknown Player";
                const isActing = acting === p.friendship_id || acting === p.id;

                return (
                  <div key={p.id} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <Avatar name={displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{displayName}</p>
                      <p className="text-[10px] font-mono text-gray-600 truncate">{p.id}</p>
                      {p.status === "accepted" && <span className="text-[11px] font-medium text-violet-400">Friend</span>}
                      {p.status === "pending_sent" && <span className="text-[11px] text-gray-500">Request sent</span>}
                      {p.status === "pending_received" && <span className="text-[11px] text-amber-400">Sent you a request</span>}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {p.status === "accepted" && (
                        <>
                          <Link href={`/players/${p.id}`}
                            className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition">
                            Collection
                          </Link>
                          <button onClick={() => cancelOrUnfriend(p.friendship_id!)} disabled={isActing}
                            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 hover:text-red-400 rounded-lg text-xs transition">
                            Unfriend
                          </button>
                        </>
                      )}
                      {p.status === "pending_received" && (
                        <>
                          <button onClick={() => respondToRequest(p.friendship_id!, "accept")} disabled={isActing}
                            className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition">
                            Accept
                          </button>
                          <button onClick={() => respondToRequest(p.friendship_id!, "reject")} disabled={isActing}
                            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 rounded-lg text-xs transition">
                            Decline
                          </button>
                        </>
                      )}
                      {p.status === "pending_sent" && (
                        <button onClick={() => cancelOrUnfriend(p.friendship_id!)} disabled={isActing}
                          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-500 rounded-lg text-xs transition">
                          Cancel
                        </button>
                      )}
                      {p.status === "none" && (
                        <button onClick={() => sendRequest(p.id)} disabled={isActing}
                          className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition">
                          {isActing ? "Sending…" : "Add Friend"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
