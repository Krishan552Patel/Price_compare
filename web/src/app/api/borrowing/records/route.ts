import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBorrowRecords, createBorrowRecord } from "@/lib/auth-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = await getBorrowRecords(session.user.id);
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const {
    contactId, cardUniqueId, cardName, imageUrl = null,
    direction, qty = 1, borrowedDate, notes = null,
  } = await req.json();
  if (!contactId || !cardUniqueId || !cardName || !direction) {
    return NextResponse.json({ error: "contactId, cardUniqueId, cardName, direction required" }, { status: 400 });
  }
  if (!["borrowed", "lent"].includes(direction)) {
    return NextResponse.json({ error: "direction must be 'borrowed' or 'lent'" }, { status: 400 });
  }
  const record = await createBorrowRecord({
    userId: session.user.id,
    contactId, cardUniqueId, cardName, imageUrl,
    direction,
    qty: Math.max(1, Number(qty)),
    borrowedDate: borrowedDate ?? new Date().toISOString().slice(0, 10),
    notes,
  });
  return NextResponse.json(record, { status: 201 });
}
