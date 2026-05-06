import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBorrowContacts, createBorrowContact } from "@/lib/auth-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contacts = await getBorrowContacts(session.user.id);
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, notes = null } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const contact = await createBorrowContact(session.user.id, name, notes);
  return NextResponse.json(contact, { status: 201 });
}
