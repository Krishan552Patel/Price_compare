import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserCollectionPublicStatus,
  setCollectionPublic,
  updateDisplayName,
} from "@/lib/auth-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getUserCollectionPublicStatus(session.user.id);
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { collection_public, display_name } = body as Record<string, unknown>;
  if (typeof collection_public === "boolean") {
    await setCollectionPublic(session.user.id, collection_public);
  }
  if ("display_name" in body) {
    await updateDisplayName(session.user.id, (display_name as string | null) ?? null);
  }
  return NextResponse.json({ ok: true });
}
