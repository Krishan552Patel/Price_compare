import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { acceptFriendRequest, deleteFriendship } from "@/lib/auth-queries";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { action } = await req.json();
  if (action === "accept") {
    await acceptFriendRequest(id, session.user.id);
  } else if (action === "reject") {
    await deleteFriendship(id, session.user.id);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteFriendship(id, session.user.id);
  return NextResponse.json({ ok: true });
}
