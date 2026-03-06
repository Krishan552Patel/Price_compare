import { NextRequest, NextResponse } from "next/server";
import { getPriceHistory } from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uniqueId: string }> }
) {
  const { uniqueId } = await params;
  const history = await getPriceHistory(uniqueId);
  
  return NextResponse.json(history, {
    headers: {
      // Cache for 1 hour, stale for 6 hours (scraper runs every 6h so keep fresh)
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
      "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
    },
  });
}
