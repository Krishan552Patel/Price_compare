import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { markNotificationRead } from "@/lib/auth-queries";

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await markNotificationRead(id, session.user.id);
  return NextResponse.json({ ok: true });
}
