import { NextRequest, NextResponse } from "next/server";
import { getPublicUserInfo, getUserPublicCollection } from "@/lib/auth-queries";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await getPublicUserInfo(userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const collection = await getUserPublicCollection(userId);
  return NextResponse.json({ user, collection });
}
