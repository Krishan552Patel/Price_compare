import { NextRequest, NextResponse } from "next/server";
import { getLowestNMPricesByPrinting } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/collection/prices?ids=<printing_unique_id,...>
 *
 * Returns the lowest in-stock NM price for each requested printing.
 * Keyed by printing_unique_id so the collection page can look them up directly.
 */
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({});

  const printingIds = ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200); // safety cap

  const prices = await getLowestNMPricesByPrinting(printingIds);
  return NextResponse.json(prices, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
