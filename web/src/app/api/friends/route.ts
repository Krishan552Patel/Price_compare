import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFriendships, sendFriendRequest, createNotification } from "@/lib/auth-queries";

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

  const friendshipId = await sendFriendRequest(session.user.id, userId);

  if (friendshipId) {
    const fromName = session.user.name ?? "Someone";
    createNotification({
      userId,
      type: "friend_request",
      fromUserId: session.user.id,
      fromUserName: fromName,
      friendshipId,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
