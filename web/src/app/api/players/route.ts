import { NextRequest, NextResponse } from "next/server";
import { searchPublicUsers } from "@/lib/auth-queries";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);
  const users = await searchPublicUsers(q);
  return NextResponse.json(users);
}
