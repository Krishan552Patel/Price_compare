import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/queries";

// In-memory cache for search results (survives within same serverless instance)
const searchCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute
const MAX_CACHE_SIZE = 500;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.toLowerCase().trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Check in-memory cache first
  const cached = searchCache.get(q);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: {
        // Vercel Edge cache + browser cache
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-Cache": "HIT",
      },
    });
  }

  const results = await searchCards(q, 8);

  // Store in cache (with size limit)
  if (searchCache.size >= MAX_CACHE_SIZE) {
    const oldest = [...searchCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 100);
    oldest.forEach(([key]) => searchCache.delete(key));
  }
  searchCache.set(q, { data: results, timestamp: Date.now() });

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "X-Cache": "MISS",
    },
  });
}
