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

// Foiling abbreviation mapping (same as Badge.tsx)
const FOILING_ABBREV: Record<string, string> = {
  S: "NF",
  R: "RF",
  C: "CF",
  G: "GF",
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

export default function PriceChart({
  cardUniqueId,
}: {
  cardUniqueId: string;
}) {
  const [rawData, setRawData] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>("NM");
  const [printingFilter, setPrintingFilter] = useState<string>("all");
  const [enabledRetailers, setEnabledRetailers] = useState<Set<string>>(new Set(["invasion", "gobelin", "etb"]));

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await fetch(
          `/api/card/${encodeURIComponent(cardUniqueId)}/history`
        );
        const points: PriceHistoryPoint[] = await resp.json();
        setRawData(points);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [cardUniqueId]);

  // Get unique printings for filter dropdown
  const uniquePrintings = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const p of rawData) {
      if (!map.has(p.printing_unique_id)) {
        const foilingLabel = FOILING_ABBREV[p.foiling || "S"] || p.foiling || "NF";
        map.set(p.printing_unique_id, {
          id: p.printing_unique_id,
          label: `${p.card_id} ${foilingLabel}`,
        });
      }
    }
    return Array.from(map.values());
  }, [rawData]);

  // Get unique retailers for toggles
  const uniqueRetailers = useMemo(() => {
    const set = new Set<string>();
    for (const p of rawData) {
      set.add(p.retailer_slug);
    }
    return Array.from(set);
  }, [rawData]);

  // Filter data based on selections
  const filteredData = useMemo(() => {
    let filtered = rawData;

    // Time range filter
    if (timeRange !== "all") {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      filtered = filtered.filter((p) => p.scraped_date >= cutoffStr);
    }

    // Condition filter
    if (conditionFilter !== "all") {
      filtered = filtered.filter((p) => p.condition === conditionFilter);
    }

    // Printing filter
    if (printingFilter !== "all") {
      filtered = filtered.filter((p) => p.printing_unique_id === printingFilter);
    }

    // Retailer filter
    filtered = filtered.filter((p) => enabledRetailers.has(p.retailer_slug));

    return filtered;
  }, [rawData, timeRange, conditionFilter, printingFilter, enabledRetailers]);

  // Build chart data
  const { chartData, seriesKeys, seriesLabels } = useMemo(() => {
    const dateMap = new Map<string, ChartDataPoint>();
    const keySet = new Set<string>();
    const labels: Record<string, string> = {};

    for (const point of filteredData) {
      // Create unique key per retailer + printing combo
      const foiling = point.foiling || "S";
      const key = `${point.retailer_slug}_${point.printing_unique_id}`;

      keySet.add(key);

      // Build display label
      const retailerLabel = RETAILER_NAMES[point.retailer_slug] || point.retailer_name;
      const foilingLabel = FOILING_ABBREV[foiling] || foiling;
      labels[key] = `${retailerLabel} ${point.card_id} ${foilingLabel}`;

      if (!dateMap.has(point.scraped_date)) {
        dateMap.set(point.scraped_date, { date: point.scraped_date });
      }
      const entry = dateMap.get(point.scraped_date)!;
      
      // If multiple prices for same key on same day, use lowest
      const existing = entry[key] as number | null;
      if (existing === null || existing === undefined || point.price_cad < existing) {
        entry[key] = point.price_cad;
      }
    }

    const sorted = Array.from(dateMap.values()).sort(
      (a, b) => (a.date as string).localeCompare(b.date as string)
    );

    return {
      chartData: sorted,
      seriesKeys: Array.from(keySet),
      seriesLabels: labels,
    };
  }, [filteredData]);

  // Get retailer from series key
  const getRetailerFromKey = (key: string) => key.split("_")[0];

  const toggleRetailer = (slug: string) => {
    setEnabledRetailers((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Loading price history...
      </div>
    );
  }

  if (rawData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No price history available yet
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Time:</span>
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

        {/* Condition Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Condition:</span>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as ConditionFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All</option>
            <option value="NM">Near Mint</option>
            <option value="LP">Lightly Played</option>
            <option value="MP">Moderately Played</option>
            <option value="HP">Heavily Played</option>
            <option value="DMG">Damaged</option>
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
              <option value="all">All Printings</option>
              {uniquePrintings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Retailer Toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-gray-400 self-center">Retailers:</span>
        {uniqueRetailers.map((slug) => (
          <button
            key={slug}
            onClick={() => toggleRetailer(slug)}
            className={`px-3 py-1 rounded text-xs font-medium transition border ${
              enabledRetailers.has(slug)
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

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data matches your filters
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                maxWidth: "300px",
              }}
              labelStyle={{ color: "#9ca3af" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                `$${Number(value).toFixed(2)}`,
                seriesLabels[name as string] || name,
              ]}
            />
            {/* Only show legend if 6 or fewer series to avoid clutter */}
            {seriesKeys.length <= 6 && (
              <Legend
                formatter={(value: string) => seriesLabels[value] || value}
              />
            )}
            {seriesKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={RETAILER_COLORS[getRetailerFromKey(key)] || getRetailerColor(getRetailerFromKey(key))}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Stats */}
      <div className="mt-4 text-xs text-gray-500">
        Showing {filteredData.length.toLocaleString()} data points from {chartData.length} dates
      </div>
    </div>
  );
}
