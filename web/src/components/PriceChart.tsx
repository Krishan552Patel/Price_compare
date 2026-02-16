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
  [retailer: string]: string | number | null;
}

export default function PriceChart({
  cardUniqueId,
}: {
  cardUniqueId: string;
}) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [retailers, setRetailers] = useState<string[]>([]);
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

        // Pivot: group by date, one column per retailer
        const dateMap = new Map<string, ChartDataPoint>();
        const retailerSet = new Set<string>();

        for (const point of points) {
          retailerSet.add(point.retailer_slug);
          if (!dateMap.has(point.scraped_date)) {
            dateMap.set(point.scraped_date, { date: point.scraped_date });
          }
          const entry = dateMap.get(point.scraped_date)!;
          entry[point.retailer_slug] = point.price_cad;
        }

        const sorted = Array.from(dateMap.values()).sort(
          (a, b) => (a.date as string).localeCompare(b.date as string)
        );

        setData(sorted);
        setRetailers(Array.from(retailerSet));
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

  const retailerNames: Record<string, string> = {
    invasion: "Invasion",
    gobelin: "Gobelin",
    etb: "ETB",
  };

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
            retailerNames[name as string] || name,
          ]}
        />
        <Legend
          formatter={(value: string) => retailerNames[value] || value}
        />
        {retailers.map((slug) => (
          <Line
            key={slug}
            type="monotone"
            dataKey={slug}
            stroke={getRetailerColor(slug)}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
