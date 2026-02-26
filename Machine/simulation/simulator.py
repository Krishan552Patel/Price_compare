"""
Simulation — Simulator
Feeds a batch of CNN output records through the full pipeline
(bridge → sort → assign) in simulation mode and reports results.

Use this to validate your sort profile and grid layout against
real or synthetic CNN data before running on physical hardware.
"""

import csv
import json
import logging
from pathlib import Path
from typing import Optional

from sorting.grid_layout import GridLayout
from sorting.sort_rules import SortRules
from sorting.bin_assigner import BinAssigner
from simulation.virtual_tray import VirtualTray
from tracking.session_logger import SessionLogger
from tracking.bin_inventory import BinInventory
from machine.mock_interface import MockInterface

logger = logging.getLogger(__name__)


class Simulator:
    """
    Runs a batch of enriched card records through the sort pipeline
    without touching any hardware.

    Usage
    -----
    sim = Simulator(
        grid_name="4x4",
        profile_name="by_rarity",
        bin_capacity=50,
    )
    sim.run_from_json("test_cards.json")
    sim.tray.render_ascii()
    sim.logger.print_summary()
    """

    def __init__(
        self,
        grid_name: str = "4x4",
        profile_name: str = "by_rarity",
        bin_capacity: int = 50,
        confidence_threshold: float = 0.85,
        session_id: Optional[str] = None,
        output_dir: str = "sessions",
    ):
        self.grid       = GridLayout.load(grid_name)
        self.rules      = SortRules.load(profile_name)
        self.assigner   = BinAssigner(self.grid, self.rules)
        self.tray       = VirtualTray(self.grid, bin_capacity=bin_capacity)
        self.inventory  = BinInventory(self.grid.rows, self.grid.cols)
        self.hardware   = MockInterface()
        self.confidence_threshold = confidence_threshold

        self.session_logger = SessionLogger(
            output_dir=output_dir,
            session_id=session_id,
        )
        self._results: list = []

    # ── batch input helpers ──────────────────────────────────────────────────

    def run_from_json(self, path: str):
        """
        Load a JSON file of enriched card records and run the simulation.

        ════════════════════════════════════════════════════════════════
        PLUG IN:
          The JSON file should be a list of enriched card dicts.
          You can generate one by running your CNN on a set of images
          and saving the output, OR by running the bridge manually
          and serialising the result with json.dump().
          See tests/test_simulation.py for a synthetic example.
        ════════════════════════════════════════════════════════════════
        """
        with open(path, encoding="utf-8") as f:
            cards = json.load(f)
        logger.info("Loaded %d cards from %s", len(cards), path)
        self.run(cards)

    def run_from_csv(self, path: str):
        """
        Load a CSV where each row is a card.
        Column headers must match enriched card field names.
        """
        with open(path, newline="", encoding="utf-8") as f:
            cards = list(csv.DictReader(f))
        logger.info("Loaded %d cards from %s", len(cards), path)
        self.run(cards)

    def run(self, cards: list):
        """
        Sort a list of enriched card dicts through the full simulation pipeline.
        """
        with self.session_logger as log:
            for card in cards:
                # Mark low-confidence cards for review
                if card.get("confidence", 1.0) < self.confidence_threshold:
                    card["needs_review"] = True

                row, col = self.assigner.assign(card)
                zone = self.rules.get_zone(card)

                # place in virtual tray
                self.tray.place(row, col, card)
                self.inventory.add(row, col, card)

                # simulate hardware movement
                self.hardware.move_to_bin(row, col)
                self.hardware.drop_card()

                # log event
                log.record(card=card, zone=zone, bin_row=row, bin_col=col)

                self._results.append({
                    "card":    card,
                    "zone":    zone,
                    "bin_row": row,
                    "bin_col": col,
                })

    # ── output helpers ───────────────────────────────────────────────────────

    def print_report(self, show_tray: bool = True):
        """Print a full simulation report to stdout."""
        self.session_logger.print_summary()
        if show_tray:
            self.tray.render_ascii()
        self.inventory.print_grid(bin_capacity=self.tray.bin_capacity)

    def show_plot(self, save_path: Optional[str] = None):
        self.tray.render_plot(
            title=f"Simulation: {self.rules.name} on {self.grid.name}",
            save_path=save_path,
        )

    def show_grid_map(self):
        """Print the zone→bin layout map for the current grid."""
        print(self.grid.ascii_map())

    @property
    def results(self) -> list:
        return list(self._results)
