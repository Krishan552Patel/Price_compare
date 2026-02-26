"""
Sorting — Bin Assigner
Combines GridLayout and SortRules to produce a physical (row, col)
address for each enriched card record.
"""

import logging
from typing import Optional

from .grid_layout import GridLayout
from .sort_rules import SortRules

logger = logging.getLogger(__name__)


class BinAssigner:
    """
    Given an enriched card record, returns the (row, col) of the bin
    the card should be deposited into.

    Usage
    -----
    assigner = BinAssigner(
        grid=GridLayout.load("4x4"),
        rules=SortRules.load("by_rarity"),
    )
    row, col = assigner.assign(enriched_card)
    """

    def __init__(self, grid: GridLayout, rules: SortRules):
        self.grid  = grid
        self.rules = rules
        self._validate_compatibility()

    def assign(self, card: dict) -> tuple:
        """
        Return (row, col) for the card.
        Falls back to overflow_bin if no matching zone is found,
        or review_bin if card.needs_review is True.
        """
        zone = self.rules.get_zone(card)

        # review shortcut
        if zone == "review" or card.get("needs_review"):
            dest = self.grid.review_bin()
            logger.info(
                "%-30s → REVIEW  %s  (confidence=%.2f)",
                card.get("name", "Unknown"),
                dest,
                card.get("confidence", 0.0),
            )
            return dest

        # resolve zone → (row, col)
        dest = self._zone_to_bin(zone)
        logger.info(
            "%-30s → zone=%-20s  bin=%s",
            card.get("name", "Unknown"),
            zone,
            dest,
        )
        return dest

    def assign_batch(self, cards: list) -> list:
        """
        Assign a list of enriched card records.
        Returns list of (card, (row, col)) tuples.
        """
        return [(card, self.assign(card)) for card in cards]

    # ── internal helpers ─────────────────────────────────────────────────────

    def _zone_to_bin(self, zone: str) -> tuple:
        """
        Convert zone name → first bin in that zone.
        Falls back to overflow if zone not found in grid.
        """
        try:
            return self.grid.first_bin_of_zone(zone)
        except KeyError:
            logger.warning(
                "Zone %r not found in grid %r — routing to overflow.",
                zone, self.grid.name,
            )
            return self.grid.overflow_bin()

    def _validate_compatibility(self):
        """
        Warn if the chosen sort profile lists compatible grids and
        the current grid is not among them.
        """
        compatible = self.rules.compatible_grids()
        if compatible and self.grid.name not in compatible:
            logger.warning(
                "Sort profile %r recommends grids %s but you are using %r. "
                "Zone names may not match — check sort_profiles.yaml.",
                self.rules.name, compatible, self.grid.name,
            )
