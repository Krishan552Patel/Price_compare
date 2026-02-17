import db from "./db";
import { parseJsonArray } from "./utils";
import type {
  Card,
  Printing,
  RetailerPrice,
  PriceHistoryPoint,
  DealItem,
  FilterOptions,
  SearchResult,
} from "./types";

// ============================================================
// SEARCH
// ============================================================

export async function searchCards(
  query: string,
  limit: number = 8
): Promise<SearchResult[]> {
  const result = await db.execute({
    sql: `SELECT c.unique_id, c.name, c.type_text,
           (SELECT p.image_url FROM printings p WHERE p.card_unique_id = c.unique_id
            AND p.image_url IS NOT NULL LIMIT 1) as image_url
         FROM cards c
         WHERE c.name LIKE ?
         ORDER BY c.name
         LIMIT ?`,
    args: [`%${query}%`, limit],
  });

  return result.rows.map((row) => ({
    unique_id: row.unique_id as string,
    name: row.name as string,
    type_text: row.type_text as string | null,
    image_url: row.image_url as string | null,
  }));
}

// ============================================================
// CARD DETAIL
// ============================================================

export async function getCard(uniqueId: string): Promise<Card | null> {
  const result = await db.execute({
    sql: `SELECT c.*,
           (SELECT p.image_url FROM printings p WHERE p.card_unique_id = c.unique_id
            AND p.image_url IS NOT NULL LIMIT 1) as image_url
         FROM cards c
         WHERE c.unique_id = ?`,
    args: [uniqueId],
  });

  if (result.rows.length === 0) return null;
  const row = result.rows[0];

  return {
    unique_id: row.unique_id as string,
    name: row.name as string,
    color: row.color as string | null,
    pitch: row.pitch as string | null,
    cost: row.cost as string | null,
    power: row.power as string | null,
    defense: row.defense as string | null,
    health: row.health as string | null,
    intelligence: row.intelligence as string | null,
    types: parseJsonArray(row.types as string),
    traits: parseJsonArray(row.traits as string),
    card_keywords: parseJsonArray(row.card_keywords as string),
    functional_text: row.functional_text as string | null,
    functional_text_plain: row.functional_text_plain as string | null,
    type_text: row.type_text as string | null,
    blitz_legal: row.blitz_legal as number,
    cc_legal: row.cc_legal as number,
    commoner_legal: row.commoner_legal as number,
    ll_legal: row.ll_legal as number,
    image_url: row.image_url as string | null,
  };
}

export async function getPrintingParent(
  printingUniqueId: string
): Promise<string | null> {
  const result = await db.execute({
    sql: "SELECT card_unique_id FROM printings WHERE unique_id = ?",
    args: [printingUniqueId],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0].card_unique_id as string;
}

export async function getCardPrintings(
  cardUniqueId: string
): Promise<Printing[]> {
  const result = await db.execute({
    sql: `SELECT p.unique_id, p.card_unique_id, p.card_id, p.set_id,
           s.name as set_name, p.edition, p.foiling, p.rarity,
           r.name as rarity_name, f.name as foiling_name,
           p.image_url, p.tcgplayer_url, p.artists, p.flavor_text
         FROM printings p
         LEFT JOIN sets s ON p.set_id = s.set_code
         LEFT JOIN rarities r ON p.rarity = r.unique_id
         LEFT JOIN foilings f ON p.foiling = f.unique_id
         WHERE p.card_unique_id = ?
         ORDER BY p.set_id, p.edition, p.foiling`,
    args: [cardUniqueId],
  });

  return result.rows.map((row) => ({
    unique_id: row.unique_id as string,
    card_unique_id: row.card_unique_id as string,
    card_id: row.card_id as string,
    set_id: row.set_id as string,
    set_name: row.set_name as string | null,
    edition: row.edition as string | null,
    foiling: row.foiling as string | null,
    rarity: row.rarity as string | null,
    rarity_name: row.rarity_name as string | null,
    foiling_name: row.foiling_name as string | null,
    image_url: row.image_url as string | null,
    tcgplayer_url: row.tcgplayer_url as string | null,
    artists: parseJsonArray(row.artists as string),
    flavor_text: row.flavor_text as string | null,
  }));
}

// ============================================================
// PRICES
// ============================================================

export async function getCardPrices(
  cardUniqueId: string
): Promise<RetailerPrice[]> {
  const result = await db.execute({
    sql: `SELECT rp.retailer_slug, ret.name as retailer_name,
           rp.product_title, rp.variant_title,
           rp.price_cad, rp.compare_at_price_cad,
           rp.in_stock, rp.product_url, rp.updated_at,
           rp.printing_unique_id,
           p.card_id, p.foiling, p.edition, p.rarity,
           f.name as foiling_name,
           e.name as edition_name,
           r.name as rarity_name,
           s.name as set_name
         FROM retailer_products rp
         JOIN retailers ret ON rp.retailer_slug = ret.slug
         JOIN printings p ON rp.printing_unique_id = p.unique_id
         LEFT JOIN foilings f ON p.foiling = f.unique_id
         LEFT JOIN editions e ON p.edition = e.unique_id
         LEFT JOIN rarities r ON p.rarity = r.unique_id
         LEFT JOIN sets s ON p.set_id = s.set_code
         WHERE p.card_unique_id = ?
         ORDER BY rp.price_cad ASC`,
    args: [cardUniqueId],
  });

  return result.rows.map((row) => ({
    retailer_slug: row.retailer_slug as string,
    retailer_name: row.retailer_name as string,
    product_title: row.product_title as string,
    variant_title: row.variant_title as string,
    price_cad: Number(row.price_cad),
    compare_at_price_cad: row.compare_at_price_cad
      ? Number(row.compare_at_price_cad)
      : null,
    in_stock: Boolean(row.in_stock),
    product_url: row.product_url as string,
    printing_unique_id: row.printing_unique_id as string,
    card_id: row.card_id as string,
    foiling: row.foiling as string | null,
    foiling_name: row.foiling_name as string | null,
    edition: row.edition as string | null,
    edition_name: row.edition_name as string | null,
    rarity: row.rarity as string | null,
    rarity_name: row.rarity_name as string | null,
    set_name: row.set_name as string | null,
    updated_at: row.updated_at as string,
  }));
}

export async function getPriceHistory(
  cardUniqueId: string
): Promise<PriceHistoryPoint[]> {
  const result = await db.execute({
    sql: `SELECT ph.scraped_date, ph.price_cad, ph.in_stock,
           ph.retailer_slug, ret.name as retailer_name
         FROM price_history ph
         JOIN retailers ret ON ph.retailer_slug = ret.slug
         JOIN printings p ON ph.printing_unique_id = p.unique_id
         WHERE p.card_unique_id = ?
         ORDER BY ph.scraped_date ASC`,
    args: [cardUniqueId],
  });

  return result.rows.map((row) => ({
    scraped_date: row.scraped_date as string,
    price_cad: Number(row.price_cad),
    in_stock: Boolean(row.in_stock),
    retailer_slug: row.retailer_slug as string,
    retailer_name: row.retailer_name as string,
  }));
}

// ============================================================
// DEALS
// ============================================================

export async function getDeals(params: {
  limit?: number;
  retailer?: string;
  minDiscount?: number;
  sort?: string;
} = {}): Promise<DealItem[]> {
  const { limit = 50, retailer, minDiscount, sort = "discount_desc" } = params;

  const conditions: string[] = [
    "rp.in_stock = 1",
    "rp.compare_at_price_cad IS NOT NULL",
    "rp.compare_at_price_cad > rp.price_cad",
    "rp.price_cad > 0",
  ];
  const args: (string | number)[] = [];

  if (retailer) {
    conditions.push("rp.retailer_slug = ?");
    args.push(retailer);
  }
  if (minDiscount) {
    conditions.push(
      "ROUND((1.0 - rp.price_cad / rp.compare_at_price_cad) * 100, 1) >= ?"
    );
    args.push(minDiscount);
  }

  const sortMap: Record<string, string> = {
    discount_desc: "discount_pct DESC",
    price_asc: "rp.price_cad ASC",
    price_desc: "rp.price_cad DESC",
  };
  const orderBy = sortMap[sort] || sortMap.discount_desc;

  args.push(limit);

  const result = await db.execute({
    sql: `SELECT c.name as card_name, p.card_id, p.image_url,
           c.unique_id as card_unique_id,
           rp.retailer_slug, ret.name as retailer_name,
           rp.price_cad, rp.compare_at_price_cad,
           ROUND((1.0 - rp.price_cad / rp.compare_at_price_cad) * 100, 1) as discount_pct,
           rp.product_url, p.foiling, p.edition, p.rarity
         FROM retailer_products rp
         JOIN retailers ret ON rp.retailer_slug = ret.slug
         JOIN printings p ON rp.printing_unique_id = p.unique_id
         JOIN cards c ON p.card_unique_id = c.unique_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY ${orderBy}
         LIMIT ?`,
    args,
  });

  return result.rows.map((row) => ({
    card_name: row.card_name as string,
    card_id: row.card_id as string,
    image_url: row.image_url as string | null,
    card_unique_id: row.card_unique_id as string,
    retailer_slug: row.retailer_slug as string,
    retailer_name: row.retailer_name as string,
    price_cad: Number(row.price_cad),
    compare_at_price_cad: Number(row.compare_at_price_cad),
    discount_pct: Number(row.discount_pct),
    product_url: row.product_url as string,
    foiling: row.foiling as string | null,
    edition: row.edition as string | null,
    rarity: row.rarity as string | null,
  }));
}

// ============================================================
// BROWSE / FILTER
// ============================================================

export async function getFilterOptions(): Promise<FilterOptions> {
  const [setsResult, raritiesResult, colorsResult, classesResult] =
    await Promise.all([
      db.execute({
        sql: `SELECT DISTINCT s.set_code, s.name
              FROM sets s
              JOIN printings p ON p.set_id = s.set_code
              ORDER BY s.name`,
        args: [],
      }),
      db.execute({
        sql: `SELECT DISTINCT r.unique_id, r.name
              FROM rarities r
              JOIN printings p ON p.rarity = r.unique_id
              ORDER BY r.name`,
        args: [],
      }),
      db.execute({
        sql: `SELECT DISTINCT color FROM cards WHERE color IS NOT NULL ORDER BY color`,
        args: [],
      }),
      db.execute({
        sql: `SELECT DISTINCT type_text FROM cards WHERE type_text IS NOT NULL ORDER BY type_text`,
        args: [],
      }),
    ]);

  return {
    sets: setsResult.rows.map((row) => ({
      set_code: row.set_code as string,
      name: row.name as string,
    })),
    rarities: raritiesResult.rows.map((row) => ({
      unique_id: row.unique_id as string,
      name: row.name as string,
    })),
    colors: colorsResult.rows.map((row) => row.color as string),
    classes: classesResult.rows.map((row) => row.type_text as string),
  };
}

export async function browseCards(params: {
  query?: string;
  set?: string;
  rarity?: string;
  color?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  groupByPrinting?: boolean;
  sort?: string;
}): Promise<{ cards: Card[]; total: number }> {
  try {
    const {
      query,
      set,
      rarity,
      color,
      type,
      minPrice,
      maxPrice,
      inStock,
      groupByPrinting = false,
      sort = "name_asc",
      page = 1,
      pageSize = 24,
    } = params;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    // Filter conditions
    if (query) {
      conditions.push("c.name LIKE ?");
      args.push(`%${query}%`);
    }
    if (set) {
      conditions.push("p.set_id = ?");
      args.push(set);
    }
    if (rarity) {
      conditions.push("p.rarity = ?");
      args.push(rarity);
    }
    if (color) {
      conditions.push("c.color = ?");
      args.push(color);
    }
    if (type) {
      conditions.push("c.type_text = ?");
      args.push(type);
    }

    // Price & Stock filtering — uses alias p_inner to avoid collision with outer p
    const priceStockJoin =
      minPrice || maxPrice || inStock
        ? `JOIN (
             SELECT DISTINCT p_inner.card_unique_id
             FROM retailer_products rp
             JOIN printings p_inner ON rp.printing_unique_id = p_inner.unique_id
             WHERE 1=1
             ${inStock ? "AND rp.in_stock = 1" : ""}
             ${minPrice ? `AND rp.price_cad >= ${Number(minPrice)}` : ""}
             ${maxPrice ? `AND rp.price_cad <= ${Number(maxPrice)}` : ""}
           ) filter ON filter.card_unique_id = c.unique_id`
        : "";

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const needsPrintingJoin = set || rarity;

    const joinClause = `
      ${needsPrintingJoin || groupByPrinting ? "JOIN printings p ON p.card_unique_id = c.unique_id" : ""}
      ${priceStockJoin}
    `;

    // Count query
    const countSql = groupByPrinting
      ? `SELECT COUNT(DISTINCT p.unique_id) as total FROM cards c ${joinClause} ${whereClause}`
      : `SELECT COUNT(DISTINCT c.unique_id) as total FROM cards c ${joinClause} ${whereClause}`;

    const countResult = await db.execute({ sql: countSql, args });
    const total = Number(countResult.rows[0].total);

    // Sort mapping
    const sortMap: Record<string, string> = {
      name_asc: "c.name ASC",
      name_desc: "c.name DESC",
      price_asc: "lowest_price IS NULL, lowest_price ASC",
      price_desc: "lowest_price IS NULL DESC, lowest_price DESC",
    };
    const orderBy = sortMap[sort] || sortMap.name_asc;

    // Main data query
    let sql = "";
    if (groupByPrinting) {
      sql = `SELECT p.unique_id as printing_uid, c.name, c.color, c.pitch, c.types, c.type_text,
               p.image_url as image_url, p.set_id as set_id, p.rarity, p.foiling,
               (SELECT s.name FROM sets s WHERE s.set_code = p.set_id) as set_name,
               (SELECT MIN(rp2.price_cad) FROM retailer_products rp2
                WHERE rp2.printing_unique_id = p.unique_id AND rp2.in_stock = 1) as lowest_price
             FROM cards c
             ${joinClause}
             ${whereClause}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`;
    } else {
      sql = `SELECT DISTINCT c.unique_id, c.name, c.color, c.pitch, c.cost, c.power,
               c.defense, c.health, c.intelligence, c.types, c.traits, c.card_keywords,
               c.functional_text, c.functional_text_plain, c.type_text,
               c.blitz_legal, c.cc_legal, c.commoner_legal, c.ll_legal,
               (SELECT p2.image_url FROM printings p2 WHERE p2.card_unique_id = c.unique_id
                AND p2.image_url IS NOT NULL LIMIT 1) as image_url,
               (SELECT MIN(rp2.price_cad) FROM retailer_products rp2
                JOIN printings p3 ON rp2.printing_unique_id = p3.unique_id
                WHERE p3.card_unique_id = c.unique_id AND rp2.in_stock = 1) as lowest_price
             FROM cards c
             ${joinClause}
             ${whereClause}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`;
    }

    const result = await db.execute({
      sql,
      args: [...args, pageSize, offset],
    });

    const cards: Card[] = result.rows.map((row) => {
      if (groupByPrinting) {
        return {
          unique_id: row.printing_uid as string,
          name: `${row.name} (${row.set_id})`,
          color: row.color as string | null,
          pitch: row.pitch as string | null,
          types: parseJsonArray(row.types as string),
          type_text: row.type_text as string | null,
          image_url: row.image_url as string | null,
          lowest_price: row.lowest_price ? Number(row.lowest_price) : null,
          cost: null,
          power: null,
          defense: null,
          health: null,
          intelligence: null,
          traits: [],
          card_keywords: [],
          functional_text: null,
          functional_text_plain: null,
          blitz_legal: 0,
          cc_legal: 0,
          commoner_legal: 0,
          ll_legal: 0,
        };
      }

      return {
        unique_id: row.unique_id as string,
        name: row.name as string,
        color: row.color as string | null,
        pitch: row.pitch as string | null,
        cost: row.cost as string | null,
        power: row.power as string | null,
        defense: row.defense as string | null,
        health: row.health as string | null,
        intelligence: row.intelligence as string | null,
        types: parseJsonArray(row.types as string),
        traits: parseJsonArray(row.traits as string),
        card_keywords: parseJsonArray(row.card_keywords as string),
        functional_text: row.functional_text as string | null,
        functional_text_plain: row.functional_text_plain as string | null,
        type_text: row.type_text as string | null,
        blitz_legal: row.blitz_legal as number,
        cc_legal: row.cc_legal as number,
        commoner_legal: row.commoner_legal as number,
        ll_legal: row.ll_legal as number,
        image_url: row.image_url as string | null,
        lowest_price: row.lowest_price ? Number(row.lowest_price) : null,
      };
    });

    return { cards, total };
  } catch (err) {
    console.error("[browseCards] Error:", err);
    return { cards: [], total: 0 };
  }
}

// ============================================================
// STATS
// ============================================================

export async function getStats(): Promise<{
  totalCards: number;
  totalPrintings: number;
  totalRetailerProducts: number;
  retailers: number;
}> {
  const [cards, printings, products, retailers] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) as c FROM cards", args: [] }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM printings", args: [] }),
    db.execute({
      sql: "SELECT COUNT(*) as c FROM retailer_products",
      args: [],
    }),
    db.execute({ sql: "SELECT COUNT(*) as c FROM retailers", args: [] }),
  ]);

  return {
    totalCards: Number(cards.rows[0].c),
    totalPrintings: Number(printings.rows[0].c),
    totalRetailerProducts: Number(products.rows[0].c),
    retailers: Number(retailers.rows[0].c),
  };
}
