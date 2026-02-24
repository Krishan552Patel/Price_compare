import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateAlert, deleteAlert } from "@/lib/auth-queries";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await updateAlert(session.user.id, id, {
    active: body.active,
    thresholdCad: body.thresholdCad !== undefined ? Number(body.thresholdCad) : undefined,
    direction: body.direction,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteAlert(session.user.id, id);
  return NextResponse.json({ ok: true });
}
