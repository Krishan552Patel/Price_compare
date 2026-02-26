"""
Tracking — Bin Inventory
Maintains a running count of what is physically in each bin.
Survives across sessions if you save/load the JSON state file.
"""

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_DEFAULT_STATE_PATH = Path("inventory_state.json")


class BinInventory:
    """
    Tracks how many cards are in each (row, col) bin.

    Usage
    -----
    inv = BinInventory(rows=4, cols=4)
    inv.add(row=0, col=1, card=enriched_card)
    inv.print_grid()
    inv.save()
    """

    def __init__(
        self,
        rows: int,
        cols: int,
        state_path: Optional[str] = None,
    ):
        self.rows = rows
        self.cols = cols
        self._state_path = Path(state_path) if state_path else _DEFAULT_STATE_PATH

        # state: { "r,c": {"count": int, "cards": [...brief card info...]} }
        self._bins: dict = {}

    # ── mutation ─────────────────────────────────────────────────────────────

    def add(self, row: int, col: int, card: dict):
        """Record a card being placed into bin (row, col)."""
        key = f"{row},{col}"
        if key not in self._bins:
            self._bins[key] = {"count": 0, "cards": []}
        self._bins[key]["count"] += 1
        self._bins[key]["cards"].append({
            "name":       card.get("name", ""),
            "rarity":     card.get("rarity") or card.get("db_rarity", ""),
            "set_id":     card.get("cnn_set_id") or card.get("db_set_id", ""),
            "foiling":    card.get("cnn_foiling") or card.get("db_foiling", ""),
            "price_cad":  card.get("price_cad"),
        })

    def clear_bin(self, row: int, col: int):
        """Empty a bin (e.g., after physically removing cards)."""
        key = f"{row},{col}"
        self._bins.pop(key, None)
        logger.info("Bin (%d, %d) cleared.", row, col)

    def clear_all(self):
        self._bins.clear()
        logger.info("All bins cleared.")

    # ── queries ──────────────────────────────────────────────────────────────

    def count(self, row: int, col: int) -> int:
        return self._bins.get(f"{row},{col}", {}).get("count", 0)

    def total_cards(self) -> int:
        return sum(b["count"] for b in self._bins.values())

    def fullest_bin(self) -> tuple:
        """Return (row, col, count) for the bin with the most cards."""
        if not self._bins:
            return (0, 0, 0)
        key, data = max(self._bins.items(), key=lambda x: x[1]["count"])
        r, c = map(int, key.split(","))
        return (r, c, data["count"])

    def bins_above_threshold(self, threshold: int) -> list:
        """Return [(row, col, count)] for bins at or above the threshold."""
        result = []
        for key, data in self._bins.items():
            if data["count"] >= threshold:
                r, c = map(int, key.split(","))
                result.append((r, c, data["count"]))
        return sorted(result, key=lambda x: -x[2])

    # ── persistence ──────────────────────────────────────────────────────────

    def save(self, path: Optional[str] = None):
        out = Path(path) if path else self._state_path
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(
                {"rows": self.rows, "cols": self.cols, "bins": self._bins},
                f, indent=2,
            )
        logger.info("Inventory saved to %s", out)

    def load(self, path: Optional[str] = None):
        src = Path(path) if path else self._state_path
        if not src.exists():
            logger.info("No existing inventory file at %s — starting fresh.", src)
            return
        with open(src, encoding="utf-8") as f:
            data = json.load(f)
        self._bins = data.get("bins", {})
        logger.info("Inventory loaded from %s (%d bins active).", src, len(self._bins))

    # ── display ──────────────────────────────────────────────────────────────

    def print_grid(self, bin_capacity: Optional[int] = None):
        """
        Print a grid showing card count per bin.
        If bin_capacity is given, show fill percentage too.
        """
        print(f"\n{'─'*6}" + "─────" * self.cols)
        print(f"  Bin Inventory  ({self.rows}×{self.cols})")
        print(f"{'─'*6}" + "─────" * self.cols)

        for r in range(self.rows):
            row_str = f"  r{r}  "
            for c in range(self.cols):
                count = self.count(r, c)
                if bin_capacity:
                    pct = int(count / bin_capacity * 100)
                    row_str += f"[{pct:>3}%]"
                else:
                    row_str += f"[{count:>3} ]"
            print(row_str)

        print(f"{'─'*6}" + "─────" * self.cols)
        print(f"  Total: {self.total_cards()} cards across {len(self._bins)} bins\n")

    def export_csv(self, path: str):
        """Export a flat CSV: row, col, count, card details."""
        import csv
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["bin_row", "bin_col", "count", "card_name", "rarity", "set_id", "foiling", "price_cad"])
            for key, data in sorted(self._bins.items()):
                r, c = map(int, key.split(","))
                for card in data["cards"]:
                    writer.writerow([
                        r, c, data["count"],
                        card.get("name", ""),
                        card.get("rarity", ""),
                        card.get("set_id", ""),
                        card.get("foiling", ""),
                        card.get("price_cad", ""),
                    ])
        logger.info("Inventory CSV exported to %s", out)
