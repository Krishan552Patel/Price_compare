"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getRetailerColor } from "@/lib/utils";
import type { PriceHistoryPoint, CardCondition } from "@/lib/types";

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | null;
}

const FOILING_ABBREV: Record<string, string> = {
  S: "NF",
  R: "RF",
  C: "CF",
  G: "GF",
};

const EDITION_NAMES: Record<string, string> = {
  A: "Alpha",
  F: "1st",
  U: "Unlim",
  N: "Normal",
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
// Default to "all" so users see data regardless of condition in the DB
type ConditionFilter = "all" | CardCondition;

export default function PriceChart({
  cardUniqueId,
}: {
  cardUniqueId: string;
}) {
  const [rawData, setRawData] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters — condition defaults to "all" so sparse data isn't hidden
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("all");
  const [printingFilter, setPrintingFilter] = useState<string>("all");
  const [enabledRetailers, setEnabledRetailers] = useState<Set<string>>(new Set());
  const [retailersInitialized, setRetailersInitialized] = useState(false);

  useEffect(() => {
    setLoading(true);
    setRawData([]);
    setRetailersInitialized(false);
    fetch(`/api/card/${encodeURIComponent(cardUniqueId)}/history`)
      .then((r) => r.json())
      .then((points: PriceHistoryPoint[]) => setRawData(points))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardUniqueId]);

  // Initialize enabled retailers from actual data (once per card)
  useEffect(() => {
    if (rawData.length > 0 && !retailersInitialized) {
      setEnabledRetailers(new Set(rawData.map((p) => p.retailer_slug)));
      setRetailersInitialized(true);
    }
  }, [rawData, retailersInitialized]);

  const uniquePrintings = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const p of rawData) {
      if (!map.has(p.printing_unique_id)) {
        const foilingLabel = FOILING_ABBREV[p.foiling || "S"] || p.foiling || "NF";
        const editionLabel = p.edition ? (EDITION_NAMES[p.edition] || p.edition) : "";
        map.set(p.printing_unique_id, {
          id: p.printing_unique_id,
          label: [editionLabel, foilingLabel].filter(Boolean).join(" ") || p.printing_unique_id,
        });
      }
    }
    return Array.from(map.values());
  }, [rawData]);

  const uniqueRetailers = useMemo(
    () => Array.from(new Set(rawData.map((p) => p.retailer_slug))),
    [rawData]
  );

  // Which conditions exist in raw data (for a useful subset of the condition dropdown)
  const availableConditions = useMemo(
    () => new Set(rawData.map((p) => p.condition)),
    [rawData]
  );

  const filteredData = useMemo(() => {
    let filtered = rawData;

    if (timeRange !== "all") {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      filtered = filtered.filter((p) => p.scraped_date >= cutoffStr);
    }

    if (conditionFilter !== "all") {
      filtered = filtered.filter((p) => p.condition === conditionFilter);
    }

    if (printingFilter !== "all") {
      filtered = filtered.filter((p) => p.printing_unique_id === printingFilter);
    }

    filtered = filtered.filter((p) => enabledRetailers.has(p.retailer_slug));

    return filtered;
  }, [rawData, timeRange, conditionFilter, printingFilter, enabledRetailers]);

  const { chartData, seriesKeys, seriesLabels, seriesPointCounts } = useMemo(() => {
    const dateMap = new Map<string, ChartDataPoint>();
    const keySet = new Set<string>();
    const labels: Record<string, string> = {};
    const pointCounts: Record<string, number> = {};

    for (const point of filteredData) {
      const foiling = point.foiling || "S";
      const key = `${point.retailer_slug}_${point.printing_unique_id}`;
      keySet.add(key);

      const retailerLabel = RETAILER_NAMES[point.retailer_slug] || point.retailer_name;
      const foilingLabel = FOILING_ABBREV[foiling] || foiling;
      const editionLabel = point.edition ? (EDITION_NAMES[point.edition] || point.edition) : "";
      labels[key] = [retailerLabel, editionLabel, foilingLabel].filter(Boolean).join(" · ");

      const dateKey = point.scraped_date.split("T")[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey });
      }
      const entry = dateMap.get(dateKey)!;
      const existing = entry[key] as number | undefined;
      if (existing === undefined || point.price_cad < existing) {
        entry[key] = point.price_cad;
      }
      pointCounts[key] = (pointCounts[key] || 0) + 1;
    }

    const sorted = Array.from(dateMap.values()).sort(
      (a, b) => (a.date as string).localeCompare(b.date as string)
    );

    return {
      chartData: sorted,
      seriesKeys: Array.from(keySet),
      seriesLabels: labels,
      seriesPointCounts: pointCounts,
    };
  }, [filteredData]);

  const getRetailerFromKey = (key: string) => key.split("_")[0];

  const toggleRetailer = (slug: string) => {
    setEnabledRetailers((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const resetFilters = () => {
    setConditionFilter("all");
    setPrintingFilter("all");
    setTimeRange("all");
    setEnabledRetailers(new Set(rawData.map((p) => p.retailer_slug)));
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="h-8 w-48 bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-8 w-36 bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="h-[300px] bg-gray-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  // ── No history at all ─────────────────────────────────────────────────────

  if (rawData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-center">
        <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
        </svg>
        <p className="text-gray-400 font-medium">No price history yet</p>
        <p className="text-sm text-gray-600">This card hasn&apos;t been tracked at any retailer. Check back after the next scrape.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Range:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {(["7d", "30d", "90d", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs transition ${timeRange === range
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {range === "all" ? "All" : range}
              </button>
            ))}
          </div>
        </div>

        {/* Condition Filter — only show options that exist in the data */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Condition:</span>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as ConditionFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All</option>
            {(["NM", "LP", "MP", "HP", "DMG"] as const).filter((c) => availableConditions.has(c)).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Printing Filter */}
        {uniquePrintings.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Printing:</span>
            <select
              value={printingFilter}
              onChange={(e) => setPrintingFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="all">All</option>
              {uniquePrintings.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Retailer Toggles */}
      {uniqueRetailers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-400 self-center">Retailers:</span>
          {uniqueRetailers.map((slug) => (
            <button
              key={slug}
              onClick={() => toggleRetailer(slug)}
              className={`px-3 py-1 rounded text-xs font-medium transition border ${enabledRetailers.has(slug)
                ? "border-transparent text-white"
                : "border-gray-600 text-gray-500 bg-transparent"
              }`}
              style={{
                backgroundColor: enabledRetailers.has(slug)
                  ? RETAILER_COLORS[slug] || "#6b7280"
                  : undefined,
              }}
            >
              {RETAILER_NAMES[slug] || slug}
            </button>
          ))}
        </div>
      )}

      {/* Chart or empty state */}
      {chartData.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <p className="text-gray-400">No data matches the current filters</p>
          <button
            onClick={resetFilters}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
              minTickGap={40}
              tickFormatter={(dateStr: string) => {
                const d = new Date(dateStr + "T12:00:00");
                return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
              domain={["auto", "auto"]}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                maxWidth: "280px",
              }}
              labelStyle={{ color: "#9ca3af" }}
              labelFormatter={(label) => {
                const d = new Date(String(label) + "T12:00:00");
                return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                `CA$${Number(value).toFixed(2)}`,
                seriesLabels[name as string] || name,
              ]}
            />
            {seriesKeys.length <= 8 && (
              <Legend formatter={(value: string) => seriesLabels[value] || value} />
            )}
            {seriesKeys.map((key) => {
              // Show dots when a series has sparse data so single points are visible
              const sparse = (seriesPointCounts[key] || 0) <= 8;
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={RETAILER_COLORS[getRetailerFromKey(key)] || getRetailerColor(getRetailerFromKey(key))}
                  strokeWidth={2}
                  dot={sparse ? { r: 3 } : false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      {chartData.length > 0 && (
        <div className="mt-3 text-xs text-gray-600">
          {filteredData.length.toLocaleString()} data point{filteredData.length !== 1 ? "s" : ""} · {chartData.length} date{chartData.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
