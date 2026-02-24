import { NextRequest, NextResponse } from "next/server";
import { getLowestNMPrices } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({});

  const cardUniqueIds = ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100); // safety cap

  const prices = await getLowestNMPrices(cardUniqueIds);
  return NextResponse.json(prices, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
