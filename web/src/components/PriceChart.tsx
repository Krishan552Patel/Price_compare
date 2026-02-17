"use client";

import { useEffect, useState } from "react";
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
import type { PriceHistoryPoint } from "@/lib/types";

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | null;
}

// Foiling abbreviation mapping (same as Badge.tsx)
const FOILING_ABBREV: Record<string, string> = {
  S: "NF",
  R: "RF",
  C: "CF",
  G: "GCF",
};

const RETAILER_NAMES: Record<string, string> = {
  invasion: "Invasion",
  gobelin: "Gobelin",
  etb: "ETB",
};

// Stroke dash patterns to visually distinguish foiling variants
const FOILING_DASH: Record<string, string | undefined> = {
  S: undefined,       // solid for non-foil
  R: "6 3",           // dashed for rainbow foil
  C: "2 2",           // dotted for cold foil
  G: "8 3 2 3",       // dash-dot for gold cold foil
};

export default function PriceChart({
  cardUniqueId,
}: {
  cardUniqueId: string;
}) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [seriesLabels, setSeriesLabels] = useState<Record<string, string>>({});
  const [seriesFoiling, setSeriesFoiling] = useState<Record<string, string>>({});
  const [seriesRetailer, setSeriesRetailer] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await fetch(
          `/api/card/${encodeURIComponent(cardUniqueId)}/history`
        );
        const points: PriceHistoryPoint[] = await resp.json();

        if (points.length === 0) {
          setLoading(false);
          return;
        }

        // Pivot: group by date, one column per retailer+foiling combo
        const dateMap = new Map<string, ChartDataPoint>();
        const keySet = new Set<string>();
        const labels: Record<string, string> = {};
        const foilings: Record<string, string> = {};
        const retailers: Record<string, string> = {};

        for (const point of points) {
          // Composite key: retailer_slug + foiling (e.g., "invasion_R", "gobelin_S")
          const foiling = point.foiling || "S";
          const key = `${point.retailer_slug}_${foiling}`;

          keySet.add(key);

          // Build display label: "Invasion RF", "Gobelin NF", etc.
          const retailerLabel = RETAILER_NAMES[point.retailer_slug] || point.retailer_name;
          const foilingLabel = FOILING_ABBREV[foiling] || foiling;
          labels[key] = `${retailerLabel} ${foilingLabel}`;
          foilings[key] = foiling;
          retailers[key] = point.retailer_slug;

          if (!dateMap.has(point.scraped_date)) {
            dateMap.set(point.scraped_date, { date: point.scraped_date });
          }
          const entry = dateMap.get(point.scraped_date)!;
          entry[key] = point.price_cad;
        }

        const sorted = Array.from(dateMap.values()).sort(
          (a, b) => (a.date as string).localeCompare(b.date as string)
        );

        setData(sorted);
        setSeriesKeys(Array.from(keySet));
        setSeriesLabels(labels);
        setSeriesFoiling(foilings);
        setSeriesRetailer(retailers);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [cardUniqueId]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Loading price history...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No price history available yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
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
          }}
          labelStyle={{ color: "#9ca3af" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `$${Number(value).toFixed(2)}`,
            seriesLabels[name as string] || name,
          ]}
        />
        <Legend
          formatter={(value: string) => seriesLabels[value] || value}
        />
        {seriesKeys.map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={getRetailerColor(seriesRetailer[key] || key)}
            strokeWidth={2}
            strokeDasharray={FOILING_DASH[seriesFoiling[key] || "S"]}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
