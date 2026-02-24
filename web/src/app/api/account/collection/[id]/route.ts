import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateCollectionEntry, deleteCollectionEntry } from "@/lib/auth-queries";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await updateCollectionEntry(session.user.id, id, {
    quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
    condition: body.condition,
    acquiredPrice: body.acquiredPrice,
    notes: body.notes,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteCollectionEntry(session.user.id, id);
  return NextResponse.json({ ok: true });
}
