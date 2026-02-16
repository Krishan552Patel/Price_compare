import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchCards(q, 8);
  return NextResponse.json(results);
}
