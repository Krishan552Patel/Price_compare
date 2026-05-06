import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFriendships, sendFriendRequest } from "@/lib/auth-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await getFriendships(session.user.id);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await req.json();
  if (!userId || userId === session.user.id) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  await sendFriendRequest(session.user.id, userId);
  return NextResponse.json({ ok: true });
}
