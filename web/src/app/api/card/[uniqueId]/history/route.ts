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
      // History changes less frequently - cache for 5 minutes
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
