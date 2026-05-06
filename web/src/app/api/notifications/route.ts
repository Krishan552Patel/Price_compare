import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUnreadNotifications, markAllNotificationsRead } from "@/lib/auth-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notifications = await getUnreadNotifications(session.user.id);
  return NextResponse.json(notifications);
}

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await markAllNotificationsRead(session.user.id);
  return NextResponse.json({ ok: true });
}
