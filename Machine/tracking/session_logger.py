"""
Tracking — Session Logger
Records every card sort event during a run.
Saves to CSV and prints a summary at the end.
"""

import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Fields written to CSV in this order.
CSV_FIELDS = [
    "timestamp",
    "session_id",
    "card_name",
    "confidence",
    "rarity",
    "set_id",
    "foiling",
    "color_identity",
    "type_line",
    "price_cad",
    "in_stock",
    "zone",
    "bin_row",
    "bin_col",
    "needs_review",
    "db_matched",
    "printing_unique_id",
]


class SessionLogger:
    """
    Logs one card per row to an in-memory list and optionally to a CSV file.

    Usage
    -----
    with SessionLogger(output_dir="sessions/") as log:
        log.record(card=enriched, zone="common", bin_row=0, bin_col=1)
    log.print_summary()
    """

    def __init__(
        self,
        output_dir: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        self.session_id  = session_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        self._output_dir = Path(output_dir) if output_dir else Path("sessions")
        self._rows: list = []
        self._csv_path: Optional[Path] = None
        self._csv_writer = None
        self._csv_file   = None

    # ── context manager ──────────────────────────────────────────────────────

    def __enter__(self):
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._csv_path = self._output_dir / f"session_{self.session_id}.csv"
        self._csv_file = open(self._csv_path, "w", newline="", encoding="utf-8")
        self._csv_writer = csv.DictWriter(
            self._csv_file, fieldnames=CSV_FIELDS, extrasaction="ignore"
        )
        self._csv_writer.writeheader()
        logger.info("Session %s started. Log: %s", self.session_id, self._csv_path)
        return self

    def __exit__(self, *_):
        if self._csv_file:
            self._csv_file.close()
        logger.info(
            "Session %s closed. %d cards recorded.",
            self.session_id, len(self._rows),
        )

    # ── main record method ───────────────────────────────────────────────────

    def record(
        self,
        card: dict,
        zone: str,
        bin_row: int,
        bin_col: int,
    ):
        """
        Record a single sort event.
        Call this once per card after BinAssigner.assign() returns.
        """
        color_identity = card.get("color_identity") or []
        if isinstance(color_identity, list):
            color_identity = "|".join(color_identity)

        row = {
            "timestamp":          datetime.now(timezone.utc).isoformat(),
            "session_id":         self.session_id,
            "card_name":          card.get("name", ""),
            "confidence":         round(card.get("confidence", 0.0), 4),
            "rarity":             card.get("rarity") or card.get("db_rarity", ""),
            "set_id":             card.get("cnn_set_id") or card.get("db_set_id", ""),
            "foiling":            card.get("cnn_foiling") or card.get("db_foiling", ""),
            "color_identity":     color_identity,
            "type_line":          card.get("type_line") or card.get("db_type_text", ""),
            "price_cad":          card.get("price_cad", ""),
            "in_stock":           card.get("in_stock", ""),
            "zone":               zone,
            "bin_row":            bin_row,
            "bin_col":            bin_col,
            "needs_review":       card.get("needs_review", False),
            "db_matched":         card.get("db_matched", False),
            "printing_unique_id": card.get("printing_unique_id", ""),
        }
        self._rows.append(row)
        if self._csv_writer:
            self._csv_writer.writerow(row)
            self._csv_file.flush()

    # ── reporting ────────────────────────────────────────────────────────────

    def print_summary(self):
        total = len(self._rows)
        if total == 0:
            print("No cards sorted in this session.")
            return

        # group by zone
        by_zone: dict = {}
        for r in self._rows:
            by_zone.setdefault(r["zone"], []).append(r)

        # group by rarity
        by_rarity: dict = {}
        for r in self._rows:
            key = r["rarity"] or "unknown"
            by_rarity.setdefault(key, 0)
            by_rarity[key] += 1

        review_count = sum(1 for r in self._rows if r["needs_review"])
        no_db_count  = sum(1 for r in self._rows if not r["db_matched"])

        print(f"\n{'═'*50}")
        print(f"  SESSION SUMMARY  —  {self.session_id}")
        print(f"{'═'*50}")
        print(f"  Total cards sorted : {total}")
        print(f"  Needs review       : {review_count}")
        print(f"  Not in DB          : {no_db_count}")
        print()
        print("  By zone:")
        for zone, cards in sorted(by_zone.items(), key=lambda x: -len(x[1])):
            print(f"    {zone:<25} {len(cards):>5} cards")
        print()
        print("  By rarity:")
        for rarity, count in sorted(by_rarity.items(), key=lambda x: -x[1]):
            print(f"    {rarity:<25} {count:>5} cards")
        if self._csv_path:
            print(f"\n  Log saved to: {self._csv_path}")
        print(f"{'═'*50}\n")

    def export_json(self, path: Optional[str] = None) -> Path:
        out = Path(path) if path else (
            self._output_dir / f"session_{self.session_id}.json"
        )
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(self._rows, f, indent=2)
        return out

    @property
    def total(self) -> int:
        return len(self._rows)

    @property
    def rows(self) -> list:
        return list(self._rows)
