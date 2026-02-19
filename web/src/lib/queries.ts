import db from "./db";
import { parseJsonArray } from "./utils";
import type {
  Card,
  Printing,
  RetailerPrice,
  PriceHistoryPoint,
  FilterOptions,
  SearchResult,
  CardCondition,
} from "./types";

// ============================================================
// SEARCH
// ============================================================

export async function searchCards(
  query: string,
  limit: number = 8
): Promise<SearchResult[]> {
  const result = await db.execute({
    sql: `SELECT DISTINCT c.unique_id, c.name, c.type_text,
           (SELECT p.image_url FROM printings p WHERE p.card_unique_id = c.unique_id
            AND p.image_url IS NOT NULL LIMIT 1) as image_url
         FROM cards c
         JOIN printings p ON p.card_unique_id = c.unique_id
         JOIN retailer_products rp ON rp.printing_unique_id = p.unique_id
         WHERE c.name LIKE ?
           AND rp.in_stock = 1
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
  cardUniqueId: string,
  inStockOnly: boolean = true
): Promise<RetailerPrice[]> {
  const stockFilter = inStockOnly ? "AND rp.in_stock = 1" : "";

  const result = await db.execute({
    sql: `SELECT rp.retailer_slug, ret.name as retailer_name,
           rp.product_title, rp.variant_title,
           rp.price_cad, rp.compare_at_price_cad,
           rp.in_stock, rp.product_url, rp.updated_at,
           rp.printing_unique_id, rp.condition,
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
         WHERE p.card_unique_id = ? ${stockFilter}
         ORDER BY rp.in_stock DESC, rp.price_cad ASC`,
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
    condition: (row.condition as CardCondition) || 'NM',
    updated_at: row.updated_at as string,
  }));
}

export async function getPriceHistory(
  cardUniqueId: string
): Promise<PriceHistoryPoint[]> {
  const result = await db.execute({
    sql: `SELECT TO_CHAR(ph.scraped_date::date, 'YYYY-MM-DD') as scraped_date,
           ph.price_cad, ph.in_stock,
           ph.retailer_slug, ret.name as retailer_name,
           ph.printing_unique_id, p.card_id, p.foiling, p.edition, ph.condition
         FROM price_history ph
         JOIN retailers ret ON ph.retailer_slug = ret.slug
         JOIN printings p ON ph.printing_unique_id = p.unique_id
         WHERE p.card_unique_id = ?
           AND ph.in_stock = 1
         ORDER BY ph.scraped_date ASC`,
    args: [cardUniqueId],
  });

  return result.rows.map((row) => ({
    scraped_date: row.scraped_date as string,
    price_cad: Number(row.price_cad),
    in_stock: Boolean(row.in_stock),
    retailer_slug: row.retailer_slug as string,
    retailer_name: row.retailer_name as string,
    printing_unique_id: row.printing_unique_id as string,
    card_id: row.card_id as string,
    foiling: row.foiling as string | null,
    edition: row.edition as string | null,
    condition: (row.condition as CardCondition) || 'NM',
  }));
}

// ============================================================
// BROWSE / FILTER
// ============================================================

// Cache for filter options (they rarely change)
let filterOptionsCache: { data: FilterOptions | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const FILTER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper: safely cast a JSON array column to json for Postgres json_array_elements_text
function jsonArrayExpr(col: string): string {
  return `CASE WHEN ${col} IS NULL OR ${col}::text = 'null' OR ${col}::text = ''
               THEN '[]'::json ELSE ${col}::json END`;
}

// All three reference tables (rarities, foilings, editions) are broken —
// they store mismatched values vs what printings actually uses.
// We query DISTINCT directly from printings and map codes here instead.

const RARITY_NAMES: Record<string, string> = {
  C: "Common",
  R: "Rare",
  S: "Super Rare",
  M: "Majestic",
  L: "Legendary",
  F: "Fabled",
  V: "Marvel",
  T: "Token",
  P: "Promo",
  B: "Bronze",
};
const RARITY_ORDER = ["C", "R", "S", "M", "L", "F", "V", "T", "P", "B"];

// printings.foiling uses: S=Standard/Normal, R=Rainbow Foil, C=Cold Foil, G=Gold Cold Foil
const FOILING_NAMES: Record<string, string> = {
  S: "Standard",
  R: "Rainbow Foil",
  C: "Cold Foil",
  G: "Gold Cold Foil",
};
const FOILING_ORDER = ["S", "R", "C", "G"];

// printings.edition uses: A=Alpha, F=First Edition, U=Unlimited, N=Normal/No edition
const EDITION_NAMES: Record<string, string> = {
  A: "Alpha",
  F: "First Edition",
  U: "Unlimited",
  N: "Normal",
};
const EDITION_ORDER = ["A", "F", "U", "N"];

export async function getFilterOptions(): Promise<FilterOptions> {
  const now = Date.now();
  if (filterOptionsCache.data && now - filterOptionsCache.timestamp < FILTER_CACHE_TTL) {
    return filterOptionsCache.data;
  }

  const [
    setsResult,
    raritiesResult,
    foilingsResult,
    editionsResult,
    colorsResult,
    keywordsResult,
    subtypesResult,
    artistsResult,
    traitsResult,
    pitchesResult,
    heroesResult,
  ] = await Promise.all([
    db.execute({
      sql: `SELECT DISTINCT s.set_code, s.name
            FROM sets s
            JOIN printings p ON p.set_id = s.set_code
            ORDER BY s.name`,
      args: [],
    }),
    // Query DISTINCT codes directly from printings — reference tables have mismatched data
    db.execute({
      sql: `SELECT DISTINCT rarity AS code FROM printings WHERE rarity IS NOT NULL AND rarity <> '' ORDER BY rarity`,
      args: [],
    }),
    db.execute({
      sql: `SELECT DISTINCT foiling AS code FROM printings WHERE foiling IS NOT NULL AND foiling <> '' ORDER BY foiling`,
      args: [],
    }),
    db.execute({
      sql: `SELECT DISTINCT edition AS code FROM printings WHERE edition IS NOT NULL AND edition <> '' ORDER BY edition`,
      args: [],
    }),
    db.execute({
      sql: `SELECT DISTINCT color FROM cards WHERE color IS NOT NULL ORDER BY color`,
      args: [],
    }),
    // Expand card_keywords JSON array — deduplicate by stripping trailing numbers (e.g. "Opt 1","Opt 2" → "Opt")
    // Exclude "* Specialization" keywords — they have their own filter
    db.execute({
      sql: `SELECT DISTINCT regexp_replace(kw.value, ' \\d+$', '') AS keyword
            FROM cards c,
            json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) AS kw(value)
            WHERE kw.value IS NOT NULL AND kw.value <> ''
              AND kw.value NOT LIKE '%Specialization'
            ORDER BY keyword`,
      args: [],
    }),
    // Expand types JSON array (subtypes like Weapon, Attack, etc.)
    db.execute({
      sql: `SELECT DISTINCT t.value AS subtype
            FROM cards c,
            json_array_elements_text(${jsonArrayExpr("c.types")}) AS t(value)
            WHERE t.value IS NOT NULL AND t.value <> ''
            ORDER BY t.value`,
      args: [],
    }),
    // Expand printings.artists JSON array
    db.execute({
      sql: `SELECT DISTINCT a.value AS artist
            FROM printings p,
            json_array_elements_text(${jsonArrayExpr("p.artists")}) AS a(value)
            WHERE a.value IS NOT NULL AND a.value <> ''
            ORDER BY a.value`,
      args: [],
    }),
    // Expand traits (Draconic, Earth, etc.)
    db.execute({
      sql: `SELECT DISTINCT tr.value AS trait
            FROM cards c,
            json_array_elements_text(${jsonArrayExpr("c.traits")}) AS tr(value)
            WHERE tr.value IS NOT NULL AND tr.value <> ''
            ORDER BY tr.value`,
      args: [],
    }),
    db.execute({
      sql: `SELECT DISTINCT pitch FROM cards WHERE pitch IS NOT NULL ORDER BY pitch`,
      args: [],
    }),
    // Hero names for specialization dropdown (extracted from card_keywords like "Katsu Specialization")
    db.execute({
      sql: `SELECT DISTINCT regexp_replace(kw.value, ' Specialization$', '') AS name
            FROM cards c,
            json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) AS kw(value)
            WHERE kw.value LIKE '%Specialization'
            ORDER BY name`,
      args: [],
    }),
  ]);

  const result: FilterOptions = {
    sets: setsResult.rows.map((row) => ({
      set_code: row.set_code as string,
      name: row.name as string,
    })),
    rarities: raritiesResult.rows
      .map((row) => ({
        unique_id: row.code as string,
        name: RARITY_NAMES[row.code as string] ?? (row.code as string),
      }))
      .sort((a, b) => {
        const ai = RARITY_ORDER.indexOf(a.unique_id);
        const bi = RARITY_ORDER.indexOf(b.unique_id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
    foilings: foilingsResult.rows
      .map((row) => ({
        unique_id: row.code as string,
        name: FOILING_NAMES[row.code as string] ?? (row.code as string),
      }))
      .sort((a, b) => {
        const ai = FOILING_ORDER.indexOf(a.unique_id);
        const bi = FOILING_ORDER.indexOf(b.unique_id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
    editions: editionsResult.rows
      .map((row) => ({
        unique_id: row.code as string,
        name: EDITION_NAMES[row.code as string] ?? (row.code as string),
      }))
      .sort((a, b) => {
        const ai = EDITION_ORDER.indexOf(a.unique_id);
        const bi = EDITION_ORDER.indexOf(b.unique_id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
    colors: colorsResult.rows.map((row) => row.color as string),
    classes: [
      "Adjudicator", "Assassin", "Bard", "Brute", "Generic", "Guardian",
      "Illusionist", "Mechanologist", "Merchant", "Necromancer", "Ninja",
      "Pirate", "Ranger", "Runeblade", "Shapeshifter", "Thief", "Warrior", "Wizard",
    ],
    keywords: keywordsResult.rows.map((row) => row.keyword as string),
    subtypes: subtypesResult.rows.map((row) => row.subtype as string),
    artists: artistsResult.rows.map((row) => row.artist as string),
    talents: traitsResult.rows.map((row) => row.trait as string),
    pitches: pitchesResult.rows.map((row) => row.pitch as string),
    heroes: heroesResult.rows.map((row) => row.name as string),
  };

  filterOptionsCache = { data: result, timestamp: now };
  return result;
}

export async function browseCards(params: {
  query?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  set?: string;
  rarity?: string;
  foiling?: string;
  edition?: string;
  color?: string;
  class?: string;
  pitch?: string;
  keyword?: string;
  subtype?: string;
  talent?: string;
  fusion?: string;
  specialization?: string;
  artVariation?: string;
  inStockOnly?: boolean;
  power?: string;
  health?: string;
  cost?: string;
  defense?: string;
}): Promise<{ cards: Card[]; total: number }> {
  try {
    const {
      query,
      sort = "name_asc",
      page = 1,
      pageSize = 24,
    } = params;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    // Text search
    if (query) {
      conditions.push("c.name ILIKE ?");
      args.push(`%${query}%`);
    }

    // Card-level filters (direct column match)
    if (params.color) {
      conditions.push("c.color = ?");
      args.push(params.color);
    }
    if (params.class) {
      // Class filter — matches class name in the types JSON array
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) t WHERE t = ?)`
      );
      args.push(params.class);
    }
    if (params.pitch !== undefined && params.pitch !== null) {
      if (params.pitch === "0") {
        // "0" pitch means cards with empty/null pitch
        conditions.push("(c.pitch IS NULL OR c.pitch = '')");
      } else {
        conditions.push("c.pitch = ?");
        args.push(params.pitch);
      }
    }

    // JSON array filters on cards table
    if (params.keyword) {
      // Support comma-separated multi-select: each must exist (AND logic)
      // Use regexp_replace to match deduplicated keywords (e.g. "Opt" matches "Opt 1", "Opt 2")
      const keywords = params.keyword.split(",").map((s) => s.trim()).filter(Boolean);
      for (const kw of keywords) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) kw WHERE regexp_replace(kw::text, ' \\d+$', '') = ?)`
        );
        args.push(kw);
      }
    }
    if (params.subtype) {
      // Support comma-separated multi-select: each must exist (AND logic)
      const subtypes = params.subtype.split(",").map((s) => s.trim()).filter(Boolean);
      for (const st of subtypes) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) st WHERE st = ?)`
        );
        args.push(st);
      }
    }
    if (params.talent) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) tr WHERE tr = ?)`
      );
      args.push(params.talent);
    }
    // Fusion filter (Earth, Ice, Lightning) — checks types array
    if (params.fusion) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) tr WHERE tr = ?)`
      );
      args.push(params.fusion);
    }
    // Specialization filter — checks card_keywords for "<hero> Specialization"
    if (params.specialization) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) kw WHERE kw = ?)`
      );
      args.push(`${params.specialization} Specialization`);
    }

    // Stat filters
    if (params.power) {
      conditions.push("c.power = ?");
      args.push(params.power);
    }
    if (params.health) {
      conditions.push("c.health = ?");
      args.push(params.health);
    }
    if (params.cost) {
      conditions.push("c.cost = ?");
      args.push(params.cost);
    }
    if (params.defense) {
      conditions.push("c.defense = ?");
      args.push(params.defense);
    }

    // Printing-level filters — use EXISTS subqueries to stay at card level
    const printingConditions: string[] = [];
    if (params.set) {
      printingConditions.push("p2.set_id = ?");
      args.push(params.set);
    }
    if (params.rarity) {
      printingConditions.push("p2.rarity = ?");
      args.push(params.rarity);
    }
    if (params.foiling) {
      printingConditions.push("p2.foiling = ?");
      args.push(params.foiling);
    }
    if (params.edition) {
      printingConditions.push("p2.edition = ?");
      args.push(params.edition);
    }
    if (params.artVariation) {
      printingConditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("p2.art_variations")}) av WHERE av = ?)`
      );
      args.push(params.artVariation);
    }
    if (printingConditions.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM printings p2 WHERE p2.card_unique_id = c.unique_id AND ${printingConditions.join(" AND ")})`
      );
    }

    // In-stock filter
    if (params.inStockOnly) {
      conditions.push(
        `EXISTS (SELECT 1 FROM printings p3 JOIN retailer_products rp2 ON rp2.printing_unique_id = p3.unique_id WHERE p3.card_unique_id = c.unique_id AND rp2.in_stock = 1)`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Sort — case-insensitive for name, NULLs always last for price sorts
    const sortMap: Record<string, string> = {
      name_asc: "LOWER(c.name) ASC",
      name_desc: "LOWER(c.name) DESC",
      price_asc: "lowest_price IS NULL ASC, lowest_price ASC, LOWER(c.name) ASC",
      price_desc: "lowest_price IS NULL ASC, lowest_price DESC, LOWER(c.name) ASC",
    };
    const orderBy = sortMap[sort] || sortMap.name_asc;

    const countResult = await db.execute({
      sql: `SELECT COUNT(DISTINCT c.unique_id) as total FROM cards c ${whereClause}`,
      args,
    });
    const total = Number(countResult.rows[0].total);

    // Build image subquery — if printing-level filters are active, prefer matching printing images
    const hasImageFilters = params.set || params.rarity || params.foiling || params.edition || params.artVariation;
    let imageSelect: string;
    const imageArgs: (string | number)[] = [];
    if (hasImageFilters) {
      const imgConds: string[] = [];
      if (params.set) { imgConds.push("pf.set_id = ?"); imageArgs.push(params.set); }
      if (params.rarity) { imgConds.push("pf.rarity = ?"); imageArgs.push(params.rarity); }
      if (params.foiling) { imgConds.push("pf.foiling = ?"); imageArgs.push(params.foiling); }
      if (params.edition) { imgConds.push("pf.edition = ?"); imageArgs.push(params.edition); }
      if (params.artVariation) {
        imgConds.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("pf.art_variations")}) av WHERE av = ?)`
        );
        imageArgs.push(params.artVariation);
      }
      const imgWhere = imgConds.join(" AND ");
      imageSelect = `
        COALESCE(
          (SELECT pf.image_url FROM printings pf
           WHERE pf.card_unique_id = c.unique_id AND pf.image_url IS NOT NULL AND ${imgWhere}
           LIMIT 1),
          (SELECT pf2.image_url FROM printings pf2
           WHERE pf2.card_unique_id = c.unique_id AND pf2.image_url IS NOT NULL
           LIMIT 1)
        ) as image_url`;
    } else {
      imageSelect = `
        (SELECT pf2.image_url FROM printings pf2
         WHERE pf2.card_unique_id = c.unique_id AND pf2.image_url IS NOT NULL
         LIMIT 1) as image_url`;
    }

    // Build price subquery args — must match the order of conditions in the price_agg subquery
    const priceArgs: (string | number)[] = [];
    if (params.set) priceArgs.push(params.set);
    if (params.rarity) priceArgs.push(params.rarity);
    if (params.foiling) priceArgs.push(params.foiling);
    if (params.edition) priceArgs.push(params.edition);
    if (params.artVariation) priceArgs.push(params.artVariation);

    const sql = `
      SELECT c.unique_id, c.name, c.color, c.pitch, c.cost, c.power,
             c.defense, c.health, c.intelligence, c.types, c.traits, c.card_keywords,
             c.functional_text, c.functional_text_plain, c.type_text,
             c.blitz_legal, c.cc_legal, c.commoner_legal, c.ll_legal,
             ${imageSelect},
             price_agg.lowest_price
      FROM cards c
      LEFT JOIN (
        SELECT p.card_unique_id, MIN(rp.price_cad) as lowest_price
        FROM retailer_products rp
        JOIN printings p ON rp.printing_unique_id = p.unique_id
        WHERE rp.in_stock = 1${params.set ? " AND p.set_id = ?" : ""}${params.rarity ? " AND p.rarity = ?" : ""}${params.foiling ? " AND p.foiling = ?" : ""}${params.edition ? " AND p.edition = ?" : ""}${params.artVariation ? ` AND EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("p.art_variations")}) av WHERE av = ?)` : ""}
        GROUP BY p.card_unique_id
      ) price_agg ON price_agg.card_unique_id = c.unique_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const result = await db.execute({ sql, args: [...imageArgs, ...priceArgs, ...args, pageSize, offset] });

    const cards: Card[] = result.rows.map((row) => ({
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
    }));

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

/**
 * Returns subtypes that co-occur with ALL selected subtypes, keywords, talent, and artVariation.
 */
export async function getAvailableSubtypes(
  selected: string[],
  crossFilters?: { keywords?: string[]; talent?: string; artVariation?: string; set?: string; edition?: string }
): Promise<string[]> {
  try {
    const conditions: string[] = [];
    const args: string[] = [];

    for (const st of selected) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) s WHERE s.value = ?)`
      );
      args.push(st);
    }
    if (crossFilters?.keywords) {
      for (const kw of crossFilters.keywords) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) k WHERE k.value = ?)`
        );
        args.push(kw);
      }
    }
    if (crossFilters?.talent) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) tt WHERE tt.value = ?)`
      );
      args.push(crossFilters.talent);
    }
    // Printing-level cross-filters
    const printConds: string[] = [];
    if (crossFilters?.artVariation) {
      printConds.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("px.art_variations")}) av WHERE av = ?)`
      );
      args.push(crossFilters.artVariation);
    }
    if (crossFilters?.set) { printConds.push("px.set_id = ?"); args.push(crossFilters.set); }
    if (crossFilters?.edition) { printConds.push("px.edition = ?"); args.push(crossFilters.edition); }
    if (printConds.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM printings px WHERE px.card_unique_id = c.unique_id AND ${printConds.join(" AND ")})`
      );
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT DISTINCT t.value as subtype
      FROM cards c, json_array_elements_text(${jsonArrayExpr("c.types")}) AS t(value)
      ${where}
      ORDER BY t.value
    `;

    const result = await db.execute({ sql, args });
    return result.rows.map((r: Record<string, unknown>) => r.subtype as string);
  } catch (error) {
    console.error("Failed to get available subtypes:", error);
    return [];
  }
}

/**
 * Returns keywords that co-occur with ALL selected keywords, subtypes, talent, and artVariation.
 */
export async function getAvailableKeywords(
  selected: string[],
  crossFilters?: { subtypes?: string[]; talent?: string; artVariation?: string; set?: string; edition?: string }
): Promise<string[]> {
  try {
    const conditions: string[] = [];
    const args: string[] = [];

    for (const kw of selected) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) s WHERE s.value = ?)`
      );
      args.push(kw);
    }
    if (crossFilters?.subtypes) {
      for (const st of crossFilters.subtypes) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) t WHERE t.value = ?)`
        );
        args.push(st);
      }
    }
    if (crossFilters?.talent) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) tt WHERE tt.value = ?)`
      );
      args.push(crossFilters.talent);
    }
    // Printing-level cross-filters
    const printConds: string[] = [];
    if (crossFilters?.artVariation) {
      printConds.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("px.art_variations")}) av WHERE av = ?)`
      );
      args.push(crossFilters.artVariation);
    }
    if (crossFilters?.set) { printConds.push("px.set_id = ?"); args.push(crossFilters.set); }
    if (crossFilters?.edition) { printConds.push("px.edition = ?"); args.push(crossFilters.edition); }
    if (printConds.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM printings px WHERE px.card_unique_id = c.unique_id AND ${printConds.join(" AND ")})`
      );
    }

    // Always exclude "* Specialization" keywords — they have their own filter
    conditions.push("kw.value NOT LIKE '%Specialization'");
    const where = `WHERE ${conditions.join(" AND ")}`;
    const sql = `
      SELECT DISTINCT regexp_replace(kw.value, ' \\d+$', '') as keyword
      FROM cards c, json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) AS kw(value)
      ${where}
      ORDER BY keyword
    `;

    const result = await db.execute({ sql, args });
    return result.rows.map((r: Record<string, unknown>) => r.keyword as string);
  } catch (error) {
    console.error("Failed to get available keywords:", error);
    return [];
  }
}

const TALENT_NAMES = [
  "Chaos", "Draconic", "Earth", "Elemental", "Ice",
  "Light", "Lightning", "Mystic", "Revered", "Reviled", "Royal", "Shadow",
];

/**
 * Returns talents that exist on cards matching the given cross-filters.
 */
export async function getAvailableTalents(
  crossFilters?: { keywords?: string[]; subtypes?: string[]; artVariation?: string; set?: string; edition?: string }
): Promise<string[]> {
  try {
    const conditions: string[] = [];
    const args: string[] = [];

    if (crossFilters?.keywords) {
      for (const kw of crossFilters.keywords) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) k WHERE k.value = ?)`
        );
        args.push(kw);
      }
    }
    if (crossFilters?.subtypes) {
      for (const st of crossFilters.subtypes) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) s WHERE s.value = ?)`
        );
        args.push(st);
      }
    }
    // Printing-level cross-filters
    const printConds: string[] = [];
    if (crossFilters?.artVariation) {
      printConds.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("px.art_variations")}) av WHERE av = ?)`
      );
      args.push(crossFilters.artVariation);
    }
    if (crossFilters?.set) { printConds.push("px.set_id = ?"); args.push(crossFilters.set); }
    if (crossFilters?.edition) { printConds.push("px.edition = ?"); args.push(crossFilters.edition); }
    if (printConds.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM printings px WHERE px.card_unique_id = c.unique_id AND ${printConds.join(" AND ")})`
      );
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const talentPlaceholders = TALENT_NAMES.map(() => "?").join(", ");

    const sql = `
      SELECT DISTINCT t.value as talent
      FROM cards c, json_array_elements_text(${jsonArrayExpr("c.types")}) AS t(value)
      ${where ? where + " AND" : "WHERE"} t.value IN (${talentPlaceholders})
      ORDER BY t.value
    `;

    const result = await db.execute({ sql, args: [...args, ...TALENT_NAMES] });
    return result.rows.map((r: Record<string, unknown>) => r.talent as string);
  } catch (error) {
    console.error("Failed to get available talents:", error);
    return [];
  }
}

/**
 * Returns art variation codes that exist on printings matching the given cross-filters.
 */
export async function getAvailableArtVariations(
  crossFilters?: { keywords?: string[]; subtypes?: string[]; talent?: string; set?: string; edition?: string }
): Promise<string[]> {
  try {
    const conditions: string[] = [];
    const args: string[] = [];
    // Printing-level conditions that apply to the same printing row
    const printConds: string[] = [];

    if (crossFilters?.keywords) {
      for (const kw of crossFilters.keywords) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) k WHERE k.value = ?)`
        );
        args.push(kw);
      }
    }
    if (crossFilters?.subtypes) {
      for (const st of crossFilters.subtypes) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) s WHERE s.value = ?)`
        );
        args.push(st);
      }
    }
    if (crossFilters?.talent) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) t WHERE t.value = ?)`
      );
      args.push(crossFilters.talent);
    }
    if (crossFilters?.set) { printConds.push("p.set_id = ?"); args.push(crossFilters.set); }
    if (crossFilters?.edition) { printConds.push("p.edition = ?"); args.push(crossFilters.edition); }

    const allConds = [...conditions, ...printConds];
    const where = allConds.length > 0 ? `WHERE ${allConds.join(" AND ")}` : "";

    const sql = `
      SELECT DISTINCT av.value as art_variation
      FROM cards c
      JOIN printings p ON p.card_unique_id = c.unique_id,
      json_array_elements_text(${jsonArrayExpr("p.art_variations")}) AS av(value)
      ${where}
      ORDER BY av.value
    `;

    const result = await db.execute({ sql, args });
    return result.rows.map((r: Record<string, unknown>) => r.art_variation as string);
  } catch (error) {
    console.error("Failed to get available art variations:", error);
    return [];
  }
}

/**
 * Returns sets that have printings matching the given cross-filters.
 */
export async function getAvailableSets(
  crossFilters?: { keywords?: string[]; subtypes?: string[]; talent?: string; artVariation?: string; edition?: string }
): Promise<string[]> {
  try {
    const conditions: string[] = [];
    const args: string[] = [];

    if (crossFilters?.keywords) {
      for (const kw of crossFilters.keywords) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) k WHERE k.value = ?)`
        );
        args.push(kw);
      }
    }
    if (crossFilters?.subtypes) {
      for (const st of crossFilters.subtypes) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) s WHERE s.value = ?)`
        );
        args.push(st);
      }
    }
    if (crossFilters?.talent) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) t WHERE t.value = ?)`
      );
      args.push(crossFilters.talent);
    }
    if (crossFilters?.artVariation) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("p.art_variations")}) av WHERE av = ?)`
      );
      args.push(crossFilters.artVariation);
    }
    if (crossFilters?.edition) { conditions.push("p.edition = ?"); args.push(crossFilters.edition); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT DISTINCT p.set_id
      FROM printings p
      JOIN cards c ON c.unique_id = p.card_unique_id
      ${where}
      ORDER BY p.set_id
    `;

    const result = await db.execute({ sql, args });
    return result.rows.map((r: Record<string, unknown>) => r.set_id as string);
  } catch (error) {
    console.error("Failed to get available sets:", error);
    return [];
  }
}

/**
 * Returns editions that have printings matching the given cross-filters.
 */
export async function getAvailableEditions(
  crossFilters?: { keywords?: string[]; subtypes?: string[]; talent?: string; artVariation?: string; set?: string }
): Promise<string[]> {
  try {
    const conditions: string[] = [];
    const args: string[] = [];

    if (crossFilters?.keywords) {
      for (const kw of crossFilters.keywords) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.card_keywords")}) k WHERE k.value = ?)`
        );
        args.push(kw);
      }
    }
    if (crossFilters?.subtypes) {
      for (const st of crossFilters.subtypes) {
        conditions.push(
          `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) s WHERE s.value = ?)`
        );
        args.push(st);
      }
    }
    if (crossFilters?.talent) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("c.types")}) t WHERE t.value = ?)`
      );
      args.push(crossFilters.talent);
    }
    if (crossFilters?.artVariation) {
      conditions.push(
        `EXISTS (SELECT 1 FROM json_array_elements_text(${jsonArrayExpr("p.art_variations")}) av WHERE av = ?)`
      );
      args.push(crossFilters.artVariation);
    }
    if (crossFilters?.set) { conditions.push("p.set_id = ?"); args.push(crossFilters.set); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT DISTINCT p.edition
      FROM printings p
      JOIN cards c ON c.unique_id = p.card_unique_id
      ${where}
      ORDER BY p.edition
    `;

    const result = await db.execute({ sql, args });
    return result.rows.map((r: Record<string, unknown>) => r.edition as string);
  } catch (error) {
    console.error("Failed to get available editions:", error);
    return [];
  }
}
