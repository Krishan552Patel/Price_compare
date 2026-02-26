"""
Bridge — Card Mapper
Takes the raw dictionary returned by identify_card() from the CNN repo
and produces a single enriched card record that the sorting engine uses.

════════════════════════════════════════════════════════════════
PLUG IN REQUIRED — CNN output field names:
  The field names below are placeholders based on the output
  description you provided.  Open your CNN repo, find the dict
  that identify_card() returns, and confirm every key listed in
  CNN_FIELD_MAP matches exactly (case-sensitive).

  Current assumed CNN output shape:
  {
      "Name"             : str,   # card name
      "Confidence"       : float, # 0.0 – 1.0
      "Set"              : str,   # set code  e.g. "MON"
      "Foil"             : str,   # "S" | "F" | …
      "rarity"           : str,   # "Common" | "Rare" | …  (from card_lookup)
      "collector_number" : str,
      "artist"           : str,
      "mana_cost"        : str,   # MTG field — confirm if FAB uses "cost"
      "type_line"        : str,
      "oracle_text"      : str,
      "power"            : str,
      "toughness"        : str,
      "colors"           : list,
      "color_identity"   : list,
      "keywords"         : list,
  }

  If your CNN returns a list of matches (top-N), pass the first
  element (highest confidence) to map_cnn_to_enriched(), or pass
  the whole list to map_batch() which picks the best one.
════════════════════════════════════════════════════════════════
"""

import logging
from typing import Optional

from .db_connector import DBConnector

logger = logging.getLogger(__name__)

# ── PLUG IN: adjust these keys to match your CNN output dict ────────────────
CNN_FIELD_MAP = {
    "name":             "Name",
    "confidence":       "Confidence",
    "set_id":           "Set",
    "foiling":          "Foil",
    "rarity":           "rarity",
    "collector_number": "collector_number",
    "artist":           "artist",
    "mana_cost":        "mana_cost",
    "type_line":        "type_line",
    "oracle_text":      "oracle_text",
    "power":            "power",
    "toughness":        "toughness",
    "colors":           "colors",
    "color_identity":   "color_identity",
    "keywords":         "keywords",
}

# Cards below this confidence score go to the REVIEW bin instead of being sorted.
# ── PLUG IN: adjust threshold based on your CNN's accuracy profile ──────────
DEFAULT_CONFIDENCE_THRESHOLD = 0.85


def map_cnn_to_enriched(
    cnn_output: dict,
    db: DBConnector,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> dict:
    """
    Merge CNN output with DB data into one enriched card record.

    Returns a dict with all fields needed by the sorting engine.
    If the card cannot be matched in the DB, db_* fields are None
    and 'needs_review' is True.

    Parameters
    ----------
    cnn_output           : raw dict from identify_card()
    db                   : open DBConnector instance
    confidence_threshold : cards below this score get needs_review=True
    """

    def cnn(key: str):
        """Pull a value from cnn_output using the mapped field name."""
        return cnn_output.get(CNN_FIELD_MAP[key])

    name       = cnn("name")
    confidence = cnn("confidence") or 0.0
    set_id     = cnn("set_id")
    foiling    = cnn("foiling")

    needs_review = confidence < confidence_threshold

    # ── DB lookups ───────────────────────────────────────────────────────────
    card_row     = db.get_card_by_name(name)     if name and not needs_review else None
    printing_row = None
    pricing_row  = None

    if card_row:
        printing_row = db.get_printing(
            card_unique_id=card_row["unique_id"],
            set_id=set_id,
            foiling=foiling,
        )

    if printing_row:
        pricing_row = db.get_pricing(printing_row["unique_id"])

    # ── assemble enriched record ─────────────────────────────────────────────
    enriched = {
        # ── from CNN ──────────────────────────────────────────────────
        "name":             name,
        "confidence":       confidence,
        "cnn_set_id":       set_id,
        "cnn_foiling":      foiling,
        "rarity":           cnn("rarity"),
        "collector_number": cnn("collector_number"),
        "artist":           cnn("artist"),
        "mana_cost":        cnn("mana_cost"),
        "type_line":        cnn("type_line"),
        "oracle_text":      cnn("oracle_text"),
        "power":            cnn("power"),
        "toughness":        cnn("toughness"),
        "colors":           cnn("colors") or [],
        "color_identity":   cnn("color_identity") or [],
        "keywords":         cnn("keywords") or [],

        # ── from DB: cards table ───────────────────────────────────────
        "db_unique_id":     card_row["unique_id"]   if card_row else None,
        "db_type_text":     card_row["type_text"]   if card_row else None,
        "db_color":         card_row["color"]        if card_row else None,
        "db_pitch":         card_row["pitch"]        if card_row else None,
        "db_cost":          card_row["cost"]         if card_row else None,
        "db_power":         card_row["power"]        if card_row else None,
        "db_defense":       card_row["defense"]      if card_row else None,

        # ── from DB: printings table ───────────────────────────────────
        "printing_unique_id": printing_row["unique_id"]  if printing_row else None,
        "db_set_id":          printing_row["set_id"]     if printing_row else None,
        "db_foiling":         printing_row["foiling"]    if printing_row else None,
        "db_rarity":          printing_row["rarity"]     if printing_row else None,
        "db_edition":         printing_row["edition"]    if printing_row else None,
        "image_url":          printing_row["image_url"]  if printing_row else None,

        # ── from DB: retailer_products table ──────────────────────────
        "price_cad":       pricing_row["lowest_price_cad"] if pricing_row else None,
        "in_stock":        bool(pricing_row["any_in_stock"]) if pricing_row else False,

        # ── status flags ───────────────────────────────────────────────
        "needs_review":    needs_review,
        "db_matched":      card_row is not None,
    }

    if needs_review:
        logger.info(
            "Card %r flagged for review (confidence=%.2f < %.2f)",
            name, confidence, confidence_threshold,
        )
    elif not card_row:
        logger.warning("Card %r not found in DB — sorting by CNN data only.", name)

    return enriched


def map_batch(
    cnn_results: list,
    db: DBConnector,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> dict:
    """
    Convenience wrapper for when identify_card() returns a ranked list.
    Takes the top result (index 0, highest confidence) and maps it.

    ════════════════════════════════════════════════════════════════
    PLUG IN: if your CNN returns results in a different order
    (lowest confidence first, or as a dict keyed by rank) adjust
    the indexing logic below.
    ════════════════════════════════════════════════════════════════
    """
    if not cnn_results:
        raise ValueError("CNN returned an empty results list.")
    top = cnn_results[0]
    return map_cnn_to_enriched(top, db, confidence_threshold)
