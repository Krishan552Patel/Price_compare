import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeckCardAllPrices } from "@/lib/queries";
import type { DeckCard, DeckCheckoutResultV2, DeckCheckoutResponseV2 } from "@/lib/types";

const PITCH_MAP: Record<string, string> = {
  red: "1",
  yellow: "2",
  blue: "3",
};

function parseDeckList(text: string): DeckCard[] {
  const cards: DeckCard[] = [];
  const seen = new Map<string, number>();

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const m = line.match(/^(\d+)x\s+(.+?)(?:\s+\((red|yellow|blue)\))?$/i);
    if (!m) continue;

    const qty = parseInt(m[1], 10);
    const name = m[2].trim();
    const pitch = m[3] ? PITCH_MAP[m[3].toLowerCase()] : null;
    const key = `${name.toLowerCase()}|${pitch ?? ""}`;

    if (seen.has(key)) {
      cards[seen.get(key)!].qty += qty;
    } else {
      seen.set(key, cards.length);
      cards.push({ qty, name, pitch });
    }
  }

  return cards;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckList } = (await req.json()) as { deckList: string };
  if (!deckList || typeof deckList !== "string") {
    return NextResponse.json({ error: "deckList required" }, { status: 400 });
  }

  const cards = parseDeckList(deckList);
  if (cards.length === 0) {
    return NextResponse.json({ error: "No cards found in deck list" }, { status: 400 });
  }

  // Fetch all available listings for each card (batched, 10 at a time)
  const results: DeckCheckoutResultV2[] = [];
  const BATCH = 10;
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const settled = await Promise.all(
      batch.map((card) => getDeckCardAllPrices(card.name, card.pitch))
    );
    for (let j = 0; j < batch.length; j++) {
      const card = batch[j];
      const rows = settled[j];
      const first = rows[0];
      results.push({
        input: card,
        cardUniqueId: first?.card_unique_id ?? null,
        cardName: first?.card_name ?? null,
        imageUrl: first?.image_url ?? null,
        options: rows.map((r) => ({
          retailerSlug: r.retailer_slug,
          retailerName: r.retailer_name,
          variantId: r.shopify_variant_id,
          price: r.price_cad,
          productUrl: r.product_url,
          foiling: r.foiling,
          edition: r.edition,
          rarity: r.rarity,
        })),
      });
    }
  }

  // Collect unique retailers present in results
  const retailerMap = new Map<string, string>();
  for (const r of results) {
    for (const opt of r.options) {
      retailerMap.set(opt.retailerSlug, opt.retailerName);
    }
  }
  const retailers = Array.from(retailerMap.entries()).map(([slug, name]) => ({
    slug,
    name,
  }));

  const response: DeckCheckoutResponseV2 = { results, retailers };
  return NextResponse.json(response);
}
