export interface Card {
  unique_id: string;
  name: string;
  color: string | null;
  pitch: string | null;
  cost: string | null;
  power: string | null;
  defense: string | null;
  health: string | null;
  intelligence: string | null;
  types: string[];
  traits: string[];
  card_keywords: string[];
  functional_text: string | null;
  functional_text_plain: string | null;
  type_text: string | null;
  blitz_legal: number;
  cc_legal: number;
  commoner_legal: number;
  ll_legal: number;
  image_url: string | null;
}

export interface Printing {
  unique_id: string;
  card_unique_id: string;
  card_id: string;
  set_id: string;
  set_name: string | null;
  edition: string | null;
  foiling: string | null;
  rarity: string | null;
  rarity_name: string | null;
  foiling_name: string | null;
  image_url: string | null;
  tcgplayer_url: string | null;
  artists: string[];
  flavor_text: string | null;
}

export interface RetailerPrice {
  retailer_slug: string;
  retailer_name: string;
  product_title: string;
  variant_title: string;
  price_cad: number;
  compare_at_price_cad: number | null;
  in_stock: boolean;
  product_url: string;
  printing_unique_id: string;
  card_id: string;
  foiling: string | null;
  foiling_name: string | null;
  edition: string | null;
  edition_name: string | null;
  rarity: string | null;
  rarity_name: string | null;
  set_name: string | null;
  updated_at: string;
}

export interface PriceHistoryPoint {
  scraped_date: string;
  price_cad: number;
  in_stock: boolean;
  retailer_slug: string;
  retailer_name: string;
}

export interface DealItem {
  card_name: string;
  card_id: string;
  image_url: string | null;
  card_unique_id: string;
  retailer_slug: string;
  retailer_name: string;
  price_cad: number;
  compare_at_price_cad: number;
  discount_pct: number;
  product_url: string;
  foiling: string | null;
  edition: string | null;
  rarity: string | null;
}

export interface SetInfo {
  set_code: string;
  name: string;
}

export interface FilterOptions {
  sets: SetInfo[];
  rarities: { unique_id: string; name: string }[];
  colors: string[];
}

export interface SearchResult {
  unique_id: string;
  name: string;
  type_text: string | null;
  image_url: string | null;
}
