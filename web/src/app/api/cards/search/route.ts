import { NextRequest, NextResponse } from "next/server";
import { searchCardsQuick } from "@/lib/queries";

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 5 * 60 * 1000; // 5 min

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const hit = cache.get(q);
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json(hit.data);

  const results = await searchCardsQuick(q);

  if (cache.size > 300) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
    oldest.forEach(([k]) => cache.delete(k));
  }
  cache.set(q, { data: results, ts: Date.now() });

  return NextResponse.json(results);
}
