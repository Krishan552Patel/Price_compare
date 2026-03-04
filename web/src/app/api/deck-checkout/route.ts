import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeckCardPrice } from "@/lib/queries";
import type { DeckCard, DeckCheckoutResult, DeckCheckoutResponse } from "@/lib/types";

// Shopify cart URL format: https://[domain]/cart/variantId:qty,variantId:qty
const RETAILER_DOMAINS: Record<string, string> = {
  invasion: "https://invasioncnc.ca",
  gobelin: "https://gobelindargent.ca",
  etb: "https://enterthebattlefield.ca",
};

const PITCH_MAP: Record<string, string> = {
  red: "1",
  yellow: "2",
  blue: "3",
};

function parseDeckList(text: string): DeckCard[] {
  const cards: DeckCard[] = [];
  const seen = new Map<string, number>(); // "name|pitch" → index in cards

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    // Match: "2x Card Name (red)" or "1x Card Name"
    const m = line.match(/^(\d+)x\s+(.+?)(?:\s+\((red|yellow|blue)\))?$/i);
    if (!m) continue;

    const qty = parseInt(m[1], 10);
    const name = m[2].trim();
    const pitch = m[3] ? PITCH_MAP[m[3].toLowerCase()] : null;
    const key = `${name.toLowerCase()}|${pitch ?? ""}`;

    if (seen.has(key)) {
      // Accumulate qty for duplicate lines (shouldn't happen in normal deck lists)
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

  const { deckList } = await req.json() as { deckList: string };
  if (!deckList || typeof deckList !== "string") {
    return NextResponse.json({ error: "deckList required" }, { status: 400 });
  }

  const cards = parseDeckList(deckList);
  if (cards.length === 0) {
    return NextResponse.json({ error: "No cards found in deck list" }, { status: 400 });
  }

  // Query cheapest listing for each card (in parallel, capped at 10 concurrent)
  const results: DeckCheckoutResult[] = [];
  const BATCH = 10;
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const settled = await Promise.all(
      batch.map((card) => getDeckCardPrice(card.name, card.pitch))
    );
    for (let j = 0; j < batch.length; j++) {
      const card = batch[j];
      const row = settled[j];
      results.push({
        input: card,
        match: row
          ? {
              cardName: row.card_name,
              cardUniqueId: row.card_unique_id,
              imageUrl: row.image_url,
              retailerSlug: row.retailer_slug,
              retailerName: row.retailer_name,
              variantId: row.shopify_variant_id,
              price: row.price_cad,
              productUrl: row.product_url,
              foiling: row.foiling,
              edition: row.edition,
            }
          : null,
      });
    }
  }

  // Build Shopify cart URLs per retailer (cheapest split)
  // Group by retailer: variantId → total qty needed
  const retailerCarts: Record<string, Map<string, number>> = {};
  let grandTotal = 0;
  let totalFound = 0;
  let totalMissing = 0;

  for (const r of results) {
    if (r.match) {
      totalFound++;
      grandTotal += r.match.price * r.input.qty;
      const slug = r.match.retailerSlug;
      if (!retailerCarts[slug]) retailerCarts[slug] = new Map();
      const cur = retailerCarts[slug].get(r.match.variantId) ?? 0;
      retailerCarts[slug].set(r.match.variantId, cur + r.input.qty);
    } else {
      totalMissing++;
    }
  }

  const cartUrls: Record<string, string> = {};
  for (const [slug, variantMap] of Object.entries(retailerCarts)) {
    const domain = RETAILER_DOMAINS[slug];
    if (!domain) continue;
    const items = Array.from(variantMap.entries())
      .map(([vid, qty]) => `${vid}:${qty}`)
      .join(",");
    cartUrls[slug] = `${domain}/cart/${items}`;
  }

  const response: DeckCheckoutResponse = {
    results,
    cartUrls,
    totalFound,
    totalMissing,
    grandTotal,
  };

  return NextResponse.json(response);
}
