import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPublicUserInfo, getUserPublicCollection, areFriends } from "@/lib/auth-queries";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  const user = await getPublicUserInfo(userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isFriend = await areFriends(session.user.id, userId);
  if (!isFriend) return NextResponse.json({ error: "Friends only" }, { status: 403 });

  const collection = await getUserPublicCollection(userId);
  return NextResponse.json({ user, collection });
}
