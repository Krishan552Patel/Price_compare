import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFriendships, sendFriendRequest, getUserById } from "@/lib/auth-queries";
import { sendFriendRequestEmail } from "@/lib/email";

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

  // Fire-and-forget email — don't block the response if it fails
  getUserById(userId).then((addressee) => {
    if (!addressee?.email) return;
    const fromName = session.user?.name ?? "Someone";
    sendFriendRequestEmail(addressee.email, fromName).catch(() => {});
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
