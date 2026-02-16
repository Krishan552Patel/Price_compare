import { NextRequest, NextResponse } from "next/server";
import { getPriceHistory } from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uniqueId: string }> }
) {
  const { uniqueId } = await params;
  const history = await getPriceHistory(uniqueId);
  return NextResponse.json(history);
}
