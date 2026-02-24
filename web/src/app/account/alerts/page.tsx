"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";

const DIRECTIONS = [
  { value: "both", label: "↕5 Any direction" },
  { value: "up", label: "↑ Price up" },
  { value: "down", label: "↓ Price down" },
];

interface AlertRow {
  id: string; card_unique_id: string; card_name: string; image_url: string | null;
  threshold_cad: number; direction: string; active: boolean;
  last_price_seen: number | null; last_notified_at: string | null; created_at: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/account/alerts").then(r => r.json());
    setAlerts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/account/alerts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
    });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active } : a));
  }

  async function remove(id: string) {
    await fetch(`/api/account/alerts/${id}`, { method: "DELETE" });
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  async function saveEdit(id: string, thresholdCad: number, direction: string) {
    await fetch(`/api/account/alerts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thresholdCad, direction }),
    });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, threshold_cad: thresholdCad, direction } : a));
    setEditing(null);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Daily email digest when prices cross your thresholds (NM pricing).</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 font-medium">No alerts set yet</p>
          <p className="text-sm text-gray-600 mt-1">Open any card page and click <strong className="text-gray-400">"Set Price Alert"</strong>.</p>
          <Link href="/cards" className="mt-4 inline-block px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition">Browse Cards</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isEditing={editing === alert.id}
              onEdit={() => setEditing(editing === alert.id ? null : alert.id)}
              onToggle={(active) => toggleActive(alert.id, active)}
              onDelete={() => remove(alert.id)}
              onSave={(threshold, direction) => saveEdit(alert.id, threshold, direction)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
function AlertCard({ alert, isEditing, onEdit, onToggle, onDelete, onSave }: {
  alert: AlertRow; isEditing: boolean;
  onEdit: () => void; onToggle: (v: boolean) => void; onDelete: () => void;
  onSave: (t: number, d: string) => void;
}) {
  const [threshold, setThreshold] = useState(String(alert.threshold_cad));
  const [direction, setDirection] = useState(alert.direction);

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition ${alert.active ? "border-gray-800" : "border-gray-800 opacity-60"}`}>
      <div className="flex items-center gap-3 p-3">
        <Link href={`/cards/${alert.card_unique_id}`} className="shrink-0">
          <CardImage src={alert.image_url} alt={alert.card_name} width={48} height={67} className="rounded w-12 h-[67px] object-cover" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/cards/${alert.card_unique_id}`}>
            <p className="font-semibold text-white text-sm truncate hover:text-red-400 transition">{alert.card_name}</p>
          </Link>
          {!isEditing ? (
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                ≥ CA${alert.threshold_cad.toFixed(2)} move
              </span>
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                {DIRECTIONS.find(d => d.value === alert.direction)?.label ?? alert.direction}
              </span>
              {alert.last_price_seen != null && (
                <span className="text-xs text-gray-500">Last seen: CA${alert.last_price_seen.toFixed(2)}</span>
              )}
              {alert.last_notified_at && (
                <span className="text-xs text-gray-600">Notified: {new Date(alert.last_notified_at).toLocaleDateString("en-CA")}</span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">≥ CA$</span>
                <input type="number" min="0.5" step="0.5" value={threshold} onChange={e => setThreshold(e.target.value)}
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500" />
              </div>
              <select value={direction} onChange={e => setDirection(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500">
                {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <button onClick={() => onSave(Number(threshold), direction)}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition">Save</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onToggle(!alert.active)}
            className={`relative w-10 h-5 rounded-full transition-colors ${alert.active ? "bg-green-600" : "bg-gray-700"}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alert.active ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
          </button>
          <button onClick={onEdit} className="text-gray-500 hover:text-gray-300 transition p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={onDelete} className="text-gray-600 hover:text-red-400 transition p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}