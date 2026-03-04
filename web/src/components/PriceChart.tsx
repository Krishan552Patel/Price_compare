"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { PriceHistoryPoint, CardCondition } from "@/lib/types";

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | null;
}

const FOILING_NAMES: Record<string, string> = {
  S: "Non-Foil",
  R: "Rainbow Foil",
  C: "Cold Foil",
  G: "Gold Cold Foil",
};

const EDITION_NAMES: Record<string, string> = {
  A: "Alpha",
  F: "1st Ed",
  U: "Unlimited",
  N: "",
};

const RETAILER_NAMES: Record<string, string> = {
  invasion: "Invasion",
  gobelin: "Gobelin",
  etb: "ETB",
};

const RETAILER_COLORS: Record<string, string> = {
  invasion: "#ef4444",
  gobelin: "#22c55e",
  etb: "#3b82f6",
};

type TimeRange = "7d" | "30d" | "90d" | "all";
type ConditionFilter = "all" | CardCondition;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = new Date(String(label) + "T12:00:00");
  return (
    <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-3 shadow-2xl min-w-[160px]">
      <p className="text-gray-500 text-xs mb-2">
        {d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
      </p>
      <div className="space-y-1.5">
        {payload.map((e: { dataKey: string; name: string; value: number; color: string }) => (
          <div key={e.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
            <span className="text-gray-400 text-xs truncate max-w-[120px]">{e.name}</span>
            <span className="text-white text-xs font-semibold ml-auto pl-2">
              CA${Number(e.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PriceChart({ cardUniqueId }: { cardUniqueId: string }) {
  const [rawData, setRawData] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("NM");
  const [printingFilter, setPrintingFilter] = useState<string>("all");
  const [enabledRetailers, setEnabledRetailers] = useState<Set<string>>(new Set());
  const [retailersInitialized, setRetailersInitialized] = useState(false);

  useEffect(() => {
    setLoading(true);
    setRawData([]);
    setRetailersInitialized(false);
    fetch(`/api/card/${encodeURIComponent(cardUniqueId)}/history`)
      .then((r) => r.json())
      .then((pts: PriceHistoryPoint[]) => setRawData(pts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardUniqueId]);

  useEffect(() => {
    if (rawData.length > 0 && !retailersInitialized) {
      setEnabledRetailers(new Set(rawData.map((p) => p.retailer_slug)));
      setRetailersInitialized(true);
    }
  }, [rawData, retailersInitialized]);

  // Fall back to "all" if no NM data exists
  useEffect(() => {
    if (rawData.length > 0 && conditionFilter === "NM" && !rawData.some((p) => p.condition === "NM")) {
      setConditionFilter("all");
    }
  }, [rawData, conditionFilter]);

  const uniquePrintings = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const p of rawData) {
      if (!map.has(p.printing_unique_id)) {
        const foil = FOILING_NAMES[p.foiling || "S"] || p.foiling || "Non-Foil";
        const ed = p.edition ? (EDITION_NAMES[p.edition] ?? p.edition) : "";
        map.set(p.printing_unique_id, {
          id: p.printing_unique_id,
          label: [ed, foil].filter(Boolean).join(" · ") || p.printing_unique_id,
        });
      }
    }
    return Array.from(map.values());
  }, [rawData]);

  const uniqueRetailers = useMemo(
    () => Array.from(new Set(rawData.map((p) => p.retailer_slug))),
    [rawData]
  );

  const availableConditions = useMemo(
    () => new Set(rawData.map((p) => p.condition)),
    [rawData]
  );

  const filteredData = useMemo(() => {
    let f = rawData;
    if (timeRange !== "all") {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      f = f.filter((p) => p.scraped_date >= cutoff.toISOString().split("T")[0]);
    }
    if (conditionFilter !== "all") f = f.filter((p) => p.condition === conditionFilter);
    if (printingFilter !== "all") f = f.filter((p) => p.printing_unique_id === printingFilter);
    f = f.filter((p) => enabledRetailers.has(p.retailer_slug));
    return f;
  }, [rawData, timeRange, conditionFilter, printingFilter, enabledRetailers]);

  const { chartData, seriesKeys, seriesLabels, isSparse } = useMemo(() => {
    const dateMap = new Map<string, ChartDataPoint>();
    const keySet = new Set<string>();
    const labels: Record<string, string> = {};

    for (const point of filteredData) {
      const key = `${point.retailer_slug}_${point.printing_unique_id}`;
      keySet.add(key);
      const retailer = RETAILER_NAMES[point.retailer_slug] || point.retailer_slug;
      const foil = FOILING_NAMES[point.foiling || "S"] || "NF";
      const ed = point.edition ? (EDITION_NAMES[point.edition] ?? point.edition) : "";
      labels[key] = [retailer, ed, foil].filter(Boolean).join(" · ");

      const dateKey = point.scraped_date.split("T")[0];
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, { date: dateKey });
      const entry = dateMap.get(dateKey)!;
      const existing = entry[key] as number | undefined;
      if (existing === undefined || point.price_cad < existing) entry[key] = point.price_cad;
    }

    const sorted = Array.from(dateMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string)
    );
    return { chartData: sorted, seriesKeys: Array.from(keySet), seriesLabels: labels, isSparse: sorted.length <= 5 };
  }, [filteredData]);

  // Current price per retailer (min across printings on the last chart date)
  const retailerCurrentPrices = useMemo(() => {
    const out: Record<string, number | null> = {};
    const lastPoint = chartData[chartData.length - 1];
    for (const slug of uniqueRetailers) {
      const keys = seriesKeys.filter((k) => k.startsWith(slug + "_"));
      let min: number | null = null;
      for (const k of keys) {
        const v = lastPoint?.[k] as number | null;
        if (v != null && v > 0 && (min === null || v < min)) min = v;
      }
      out[slug] = min;
    }
    return out;
  }, [chartData, seriesKeys, uniqueRetailers]);

  // Period low/high across all visible series
  const periodStats = useMemo(() => {
    const vals = chartData.flatMap((d) =>
      seriesKeys.map((k) => d[k] as number | null).filter((v): v is number => v != null && v > 0)
    );
    if (vals.length === 0) return null;
    return { low: Math.min(...vals), high: Math.max(...vals) };
  }, [chartData, seriesKeys]);

  const getRetailerFromKey = (key: string) => key.split("_")[0];
  const safeId = (key: string) => key.replace(/[^a-zA-Z0-9]/g, "_");

  const toggleRetailer = (slug: string) => {
    setEnabledRetailers((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => <div key={i} className="h-6 w-16 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
          <div className="h-7 w-44 bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="h-[240px] bg-gray-800/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-800/60 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ── No data ────────────────────────────────────────────────────────────────
  if (rawData.length === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center gap-2 text-center">
        <svg className="w-9 h-9 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
        </svg>
        <p className="text-gray-400 font-medium text-sm">No price history yet</p>
        <p className="text-xs text-gray-600">Check back after the next scrape.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top row: filters left, time range right */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Condition pills */}
          <div className="flex gap-1 bg-gray-800/60 rounded-lg p-0.5">
            {(["NM", "LP", "MP", "HP", "DMG", "all"] as const)
              .filter((c) => c === "all" || availableConditions.has(c))
              .map((c) => (
                <button
                  key={c}
                  onClick={() => setConditionFilter(c)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    conditionFilter === c
                      ? "bg-gray-700 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
          </div>

          {/* Printing dropdown — only if multiple exist */}
          {uniquePrintings.length > 1 && (
            <select
              value={printingFilter}
              onChange={(e) => setPrintingFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-gray-500"
            >
              <option value="all">All printings</option>
              {uniquePrintings.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Time range */}
        <div className="flex bg-gray-800/80 rounded-lg p-0.5 gap-0.5">
          {(["7d", "30d", "90d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                timeRange === r ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {r === "all" ? "All" : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <p className="text-gray-400 text-sm">No data for current filters</p>
          <button
            onClick={() => { setConditionFilter("all"); setPrintingFilter("all"); setTimeRange("all"); setEnabledRetailers(new Set(rawData.map((p) => p.retailer_slug))); }}
            className="text-xs text-red-400 hover:text-red-300 transition"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 6, right: 2, bottom: 0, left: 0 }}>
            <defs>
              {seriesKeys.map((key) => {
                const color = RETAILER_COLORS[getRetailerFromKey(key)] || "#6b7280";
                return (
                  <linearGradient key={key} id={safeId(key)} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
              tickFormatter={(d: string) => {
                const dt = new Date(d + "T12:00:00");
                return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v}`}
              domain={["auto", "auto"]}
              width={44}
            />
            <Tooltip content={<ChartTooltip />} />
            {seriesKeys.map((key) => {
              const color = RETAILER_COLORS[getRetailerFromKey(key)] || "#6b7280";
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={seriesLabels[key]}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${safeId(key)})`}
                  dot={isSparse ? { r: 4, fill: color, strokeWidth: 0 } : false}
                  activeDot={{ r: 5, fill: color, stroke: "#111827", strokeWidth: 2 }}
                  connectNulls
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Retailer legend cards — click to toggle */}
      {uniqueRetailers.length > 0 && (
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${uniqueRetailers.length}, minmax(0, 1fr))` }}>
          {uniqueRetailers.map((slug) => {
            const active = enabledRetailers.has(slug);
            const color = RETAILER_COLORS[slug] || "#6b7280";
            const price = retailerCurrentPrices[slug];
            return (
              <button
                key={slug}
                onClick={() => toggleRetailer(slug)}
                title={active ? "Click to hide" : "Click to show"}
                className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                  active
                    ? "border-gray-700 bg-gray-800/50 hover:bg-gray-800"
                    : "border-gray-800 bg-gray-900/40 opacity-40 hover:opacity-60"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: active ? color : "#374151" }}
                  />
                  <span className="text-xs text-gray-400 font-medium">
                    {RETAILER_NAMES[slug] || slug}
                  </span>
                </div>
                <span className={`text-base font-bold tabular-nums ${active ? "text-white" : "text-gray-600"}`}>
                  {price != null ? `CA$${price.toFixed(2)}` : <span className="text-gray-600 text-sm">—</span>}
                </span>
                <span className="text-xs text-gray-600 mt-0.5">
                  {price != null ? "current" : "no data"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Period stats */}
      {periodStats && chartData.length > 1 && (
        <div className="mt-3 flex gap-4 text-xs text-gray-600">
          <span>
            Period low:{" "}
            <span className="text-gray-400 font-medium">CA${periodStats.low.toFixed(2)}</span>
          </span>
          <span>
            Period high:{" "}
            <span className="text-gray-400 font-medium">CA${periodStats.high.toFixed(2)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
