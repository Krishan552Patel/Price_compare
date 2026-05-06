"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface CollectionSummary { totalCards: number; currentValue: number; costBasis: number; }
interface AlertSummary { total: number; active: number; }

export default function AccountDashboard() {
  const { data: session } = useSession();
  const [collSummary, setCollSummary] = useState<CollectionSummary | null>(null);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [collPublic, setCollPublic] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account/collection").then(r => r.json()).then((rows: any[]) => {
      const totalCards = rows.reduce((s, r) => s + r.quantity, 0);
      const costBasis = rows.reduce((s, r) => s + (r.acquired_price ?? 0) * r.quantity, 0);
      setCollSummary({ totalCards, currentValue: 0, costBasis });
    });
    fetch("/api/account/alerts").then(r => r.json()).then((rows: any[]) => {
      setAlertSummary({ total: rows.length, active: rows.filter((a: any) => a.active).length });
    });
    fetch("/api/account/settings").then(r => r.json()).then((s: any) => {
      setCollPublic(s.collection_public ?? false);
      setDisplayName(s.display_name ?? "");
      setSettingsLoading(false);
    });
  }, []);

  async function saveSettings() {
    await fetch("/api/account/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection_public: collPublic, display_name: displayName.trim() || null }),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-1">
        Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="text-gray-400 text-sm mb-8">{session?.user?.email}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link href="/account/collection" className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-6 transition group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white group-hover:text-red-400 transition">Collection</h2>
          </div>
          {collSummary ? (
            <div className="space-y-1">
              <p className="text-3xl font-bold text-white">{collSummary.totalCards}</p>
              <p className="text-sm text-gray-400">cards owned</p>
              {collSummary.costBasis > 0 && (
                <p className="text-xs text-gray-500 mt-2">Cost basis: CA${collSummary.costBasis.toFixed(2)}</p>
              )}
            </div>
          ) : (
            <div className="h-10 bg-gray-800 rounded animate-pulse" />
          )}
        </Link>

        <Link href="/account/alerts" className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-6 transition group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white group-hover:text-red-400 transition">Price Alerts</h2>
          </div>
          {alertSummary ? (
            <div className="space-y-1">
              <p className="text-3xl font-bold text-white">{alertSummary.active}</p>
              <p className="text-sm text-gray-400">active alert{alertSummary.active !== 1 ? "s" : ""}</p>
              {alertSummary.total > alertSummary.active && (
                <p className="text-xs text-gray-500 mt-2">{alertSummary.total - alertSummary.active} paused</p>
              )}
            </div>
          ) : (
            <div className="h-10 bg-gray-800 rounded animate-pulse" />
          )}
        </Link>
      </div>

      {/* Collection visibility settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-base font-semibold text-white mb-4">Collection Settings</h2>
        {settingsLoading ? (
          <div className="h-10 bg-gray-800 rounded animate-pulse" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Public Collection</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Allow other players to browse your collection on the{" "}
                  <Link href="/players" className="text-blue-400 hover:underline">Players</Link> page.
                </div>
              </div>
              <button
                onClick={() => setCollPublic((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${collPublic ? "bg-blue-600" : "bg-gray-700"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${collPublic ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {collPublic && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Display Name (optional)</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={session?.user?.name ?? "Your name"}
                  className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            {collPublic && session?.user?.id && (
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1">Your Player ID</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-gray-300 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 break-all select-all">
                    {session.user.id}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(session.user!.id!)}
                    className="shrink-0 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded text-xs transition"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">Share this so friends can find you on the Players page.</p>
              </div>
            )}
            <button
              onClick={saveSettings}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition"
            >
              {settingsSaved ? "Saved ✓" : "Save Settings"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/cards" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">Browse Cards</Link>
        <Link href="/trending" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">Trending</Link>
        <Link href="/watchlist" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">Watchlist</Link>
        <Link href="/borrowing" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">Borrowing</Link>
        <Link href="/players" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">Players</Link>
      </div>
    </div>
  );
}
