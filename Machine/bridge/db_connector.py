"""
Bridge — DB Connector
Connects to the Price_compare PostgreSQL database and exposes
lookup methods used by card_mapper to enrich CNN output.

════════════════════════════════════════════════════════════════
PLUG IN REQUIRED:
  Set the DATABASE_URL environment variable (or edit the fallback
  below) with the Neon connection string from the Price_compare repo.

  Example:
    export DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

  The connection string lives in the Price_compare repo at:
    .env  →  DATABASE_URL (or equivalent)
════════════════════════════════════════════════════════════════
"""

import os
import logging
from typing import Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    raise ImportError(
        "psycopg2 is required. Install with: pip install psycopg2-binary"
    )

logger = logging.getLogger(__name__)

# ── PLUG IN: replace None with your connection string if not using env var ──
_FALLBACK_DATABASE_URL: Optional[str] = None


class DBConnector:
    """
    Wraps a psycopg2 connection to the Price_compare database.
    Use as a context manager or call .connect() / .close() manually.
    """

    def __init__(self, database_url: Optional[str] = None):
        url = database_url or os.getenv("DATABASE_URL") or _FALLBACK_DATABASE_URL
        if not url:
            raise EnvironmentError(
                "DATABASE_URL is not set.\n"
                "Set the environment variable or edit _FALLBACK_DATABASE_URL "
                "in bridge/db_connector.py."
            )
        self._url = url
        self._conn = None

    # ── connection lifecycle ─────────────────────────────────────────────────

    def connect(self):
        self._conn = psycopg2.connect(self._url)
        self._conn.autocommit = True
        logger.debug("DB connection established.")

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None
            logger.debug("DB connection closed.")

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *_):
        self.close()

    # ── query helpers ────────────────────────────────────────────────────────

    def _cursor(self):
        if not self._conn:
            raise RuntimeError("Not connected. Call connect() first.")
        return self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── public look-up methods ───────────────────────────────────────────────

    def get_card_by_name(self, name: str) -> Optional[dict]:
        """
        Look up a card record from the cards table by exact name.

        ════════════════════════════════════════════════════════════════
        PLUG IN — confirm table/column names match your DB:
          Table  : cards
          Columns: unique_id, name, type_text, color, pitch, cost,
                   power, defense, health, intelligence, types, traits,
                   card_keywords, functional_text, type_text,
                   blitz_legal, cc_legal, commoner_legal, ll_legal

        If you are sorting MTG cards rather than Flesh and Blood cards
        the schema will differ — update the SELECT columns accordingly.
        ════════════════════════════════════════════════════════════════
        """
        sql = """
            SELECT
                unique_id,
                name,
                type_text,
                color,
                pitch,
                cost,
                power,
                defense,
                types,
                card_keywords,
                functional_text
            FROM cards
            WHERE name = %s
            LIMIT 1
        """
        with self._cursor() as cur:
            cur.execute(sql, (name,))
            row = cur.fetchone()
        if row is None:
            logger.warning("No card found in DB for name: %r", name)
        return dict(row) if row else None

    def get_printing(
        self,
        card_unique_id: str,
        set_id: Optional[str] = None,
        foiling: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Find the best-matching printing for a card.
        Matches on card_unique_id; optionally narrows by set_id and foiling.

        ════════════════════════════════════════════════════════════════
        PLUG IN — confirm column names:
          Table  : printings
          Columns: unique_id, card_unique_id, card_id, set_id, edition,
                   foiling, rarity, image_url, tcgplayer_url, artists,
                   flavor_text

        Foiling codes used in your DB:
          S = Standard (non-foil)
          F = Foil (cold/rainbow)
          C = Cold foil
          G = Gold stamped
          ... confirm the exact codes your CNN returns vs what the DB stores
        ════════════════════════════════════════════════════════════════
        """
        conditions = ["card_unique_id = %s"]
        params: list = [card_unique_id]

        if set_id:
            conditions.append("set_id = %s")
            params.append(set_id)
        if foiling:
            conditions.append("foiling = %s")
            params.append(foiling)

        sql = f"""
            SELECT
                unique_id,
                card_unique_id,
                set_id,
                edition,
                foiling,
                rarity,
                image_url,
                artists,
                flavor_text
            FROM printings
            WHERE {' AND '.join(conditions)}
            LIMIT 1
        """
        with self._cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
        return dict(row) if row else None

    def get_pricing(self, printing_unique_id: str) -> Optional[dict]:
        """
        Fetch the best available price for a printing.
        Returns the lowest in-stock price across all retailers.

        ════════════════════════════════════════════════════════════════
        PLUG IN — confirm column names:
          Table  : retailer_products
          Columns: retailer_slug, shopify_variant_id, printing_unique_id,
                   product_title, variant_title, price_cad, in_stock,
                   condition, updated_at
        ════════════════════════════════════════════════════════════════
        """
        sql = """
            SELECT
                MIN(price_cad) AS lowest_price_cad,
                MAX(in_stock)  AS any_in_stock
            FROM retailer_products
            WHERE printing_unique_id = %s
              AND in_stock = 1
        """
        with self._cursor() as cur:
            cur.execute(sql, (printing_unique_id,))
            row = cur.fetchone()
        return dict(row) if row else None
