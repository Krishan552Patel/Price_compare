import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getServerWatchlist,
  addToServerWatchlist,
  removeFromServerWatchlist,
} from "@/lib/auth-queries";

// GET — returns WatchlistEntry-shaped objects for the useWatchlist hook
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await getServerWatchlist(session.user.id);

  const entries = list.map((row) => ({
    cardUniqueId: row.card_unique_id,
    cardName: row.card_name ?? "",
    imageUrl: row.image_url,
    priceAtAdd: row.price_at_add,
    addedAt: row.added_at,
  }));

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { cardUniqueId, priceAtAdd = null } = await req.json();
  if (!cardUniqueId) return NextResponse.json({ error: "cardUniqueId required" }, { status: 400 });
  await addToServerWatchlist(session.user.id, cardUniqueId, priceAtAdd ? Number(priceAtAdd) : null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { cardUniqueId } = await req.json();
  if (!cardUniqueId) return NextResponse.json({ error: "cardUniqueId required" }, { status: 400 });
  await removeFromServerWatchlist(session.user.id, cardUniqueId);
  return NextResponse.json({ ok: true });
}
