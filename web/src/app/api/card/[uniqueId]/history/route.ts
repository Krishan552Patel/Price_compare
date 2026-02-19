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
      // Cache for 6 hours, stale for 24 hours (history grows 2x/day)
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      "CDN-Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      "Vercel-CDN-Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
