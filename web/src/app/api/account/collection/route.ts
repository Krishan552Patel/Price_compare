import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCollection, addToCollection } from "@/lib/auth-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await getCollection(session.user.id);
  return NextResponse.json(collection);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { printingUniqueId, quantity = 1, condition = "NM", acquiredPrice = null, notes = null } = await req.json();
    if (!printingUniqueId) return NextResponse.json({ error: "printingUniqueId required" }, { status: 400 });
    const row = await addToCollection({
      userId: session.user.id,
      printingUniqueId,
      quantity: Math.max(1, Number(quantity)),
      condition,
      acquiredPrice: acquiredPrice ? Number(acquiredPrice) : null,
      notes,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[collection POST]", err);
    return NextResponse.json({ error: "Failed to add to collection." }, { status: 500 });
  }
}
