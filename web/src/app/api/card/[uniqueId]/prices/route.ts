import { NextRequest, NextResponse } from "next/server";
import { getCardPrices } from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uniqueId: string }> }
) {
  const { uniqueId } = await params;
  const prices = await getCardPrices(uniqueId);
  return NextResponse.json(prices);
}
