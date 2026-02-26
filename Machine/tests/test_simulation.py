"""
Tests — Simulation Pipeline
Validates that the sort pipeline produces correct bin assignments
without needing a DB connection or hardware.

Run with:  python -m pytest tests/  -v
"""

import sys
from pathlib import Path

# Allow imports from repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from sorting.grid_layout import GridLayout
from sorting.sort_rules import SortRules
from sorting.bin_assigner import BinAssigner
from simulation.virtual_tray import VirtualTray
from simulation.simulator import Simulator
from tracking.bin_inventory import BinInventory


# ── synthetic card factory ────────────────────────────────────────────────────

def make_card(
    name="Test Card",
    confidence=0.95,
    rarity="Common",
    set_id="TEST",
    foiling="S",
    color_identity=None,
    price_cad=None,
    needs_review=False,
    db_matched=True,
):
    """
    Create a synthetic enriched card dict for testing.
    Matches the output shape of bridge/card_mapper.py.

    ════════════════════════════════════════════════════════════════
    PLUG IN:
      Once your CNN and bridge are working, replace these synthetic
      cards with real output from map_cnn_to_enriched() to run
      integration tests against actual data.
    ════════════════════════════════════════════════════════════════
    """
    return {
        "name":               name,
        "confidence":         confidence,
        "cnn_set_id":         set_id,
        "cnn_foiling":        foiling,
        "rarity":             rarity,
        "type_line":          "Creature — Test",
        "color_identity":     color_identity or [],
        "colors":             color_identity or [],
        "price_cad":          price_cad,
        "in_stock":           True,
        "needs_review":       needs_review,
        "db_matched":         db_matched,
        "printing_unique_id": f"{name.lower().replace(' ','_')}_{set_id}",
        "db_unique_id":       f"card_{name.lower().replace(' ','_')}",
    }


# ── GridLayout tests ─────────────────────────────────────────────────────────

class TestGridLayout:

    def test_load_4x4(self):
        grid = GridLayout.load("4x4")
        assert grid.rows == 4
        assert grid.cols == 4
        assert grid.total_bins() == 16

    def test_load_4x16(self):
        grid = GridLayout.load("4x16")
        assert grid.rows == 4
        assert grid.cols == 16
        assert grid.total_bins() == 64

    def test_zone_bins_common(self):
        grid = GridLayout.load("4x4")
        bins = grid.zone_bins("common")
        assert len(bins) == 4
        assert bins[0] == [0, 0]

    def test_valid_bin(self):
        grid = GridLayout.load("4x4")
        assert grid.is_valid_bin(0, 0)
        assert grid.is_valid_bin(3, 3)
        assert not grid.is_valid_bin(4, 0)
        assert not grid.is_valid_bin(0, 4)

    def test_overflow_bin(self):
        grid = GridLayout.load("4x4")
        assert grid.overflow_bin() == (3, 3)

    def test_unknown_grid_raises(self):
        with pytest.raises(ValueError, match="not found"):
            GridLayout.load("99x99")

    def test_ascii_map_runs(self):
        grid = GridLayout.load("4x4")
        result = grid.ascii_map()
        assert "col0" in result
        assert "row0" in result


# ── SortRules tests ───────────────────────────────────────────────────────────

class TestSortRules:

    def test_common_goes_to_common(self):
        rules = SortRules.load("by_rarity")
        card  = make_card(rarity="Common")
        assert rules.get_zone(card) == "common"

    def test_rare_goes_to_rare(self):
        rules = SortRules.load("by_rarity")
        card  = make_card(rarity="Rare")
        assert rules.get_zone(card) == "rare"

    def test_mythic_goes_to_mythic(self):
        rules = SortRules.load("by_rarity")
        card  = make_card(rarity="Mythic Rare")
        assert rules.get_zone(card) == "mythic"

    def test_review_flag_overrides_rarity(self):
        rules = SortRules.load("by_rarity")
        card  = make_card(rarity="Rare", needs_review=True)
        assert rules.get_zone(card) == "review"

    def test_short_rarity_code(self):
        """CNN may return 'R' instead of 'Rare' — both should map to rare."""
        rules = SortRules.load("by_rarity")
        card  = make_card(rarity="R")
        assert rules.get_zone(card) == "rare"

    def test_unknown_profile_raises(self):
        with pytest.raises(ValueError, match="not found"):
            SortRules.load("nonexistent_profile")


# ── BinAssigner tests ─────────────────────────────────────────────────────────

class TestBinAssigner:

    def setup_method(self):
        self.grid     = GridLayout.load("4x4")
        self.rules    = SortRules.load("by_rarity")
        self.assigner = BinAssigner(self.grid, self.rules)

    def test_common_assigned_to_row_0(self):
        card = make_card(rarity="Common")
        row, col = self.assigner.assign(card)
        assert row == 0

    def test_rare_assigned_to_row_2(self):
        card = make_card(rarity="Rare")
        row, col = self.assigner.assign(card)
        assert row == 2

    def test_review_assigned_to_review_bin(self):
        card      = make_card(needs_review=True)
        row, col  = self.assigner.assign(card)
        assert (row, col) == self.grid.review_bin()

    def test_unknown_rarity_uses_overflow(self):
        card = make_card(rarity="Totally Unknown Rarity XYZ")
        row, col = self.assigner.assign(card)
        assert (row, col) == self.grid.overflow_bin()

    def test_batch_returns_all(self):
        cards = [make_card(rarity=r) for r in ["Common", "Rare", "Uncommon"]]
        results = self.assigner.assign_batch(cards)
        assert len(results) == 3


# ── VirtualTray tests ─────────────────────────────────────────────────────────

class TestVirtualTray:

    def setup_method(self):
        self.grid = GridLayout.load("4x4")
        self.tray = VirtualTray(self.grid, bin_capacity=10)

    def test_initial_counts_zero(self):
        assert self.tray.count(0, 0) == 0
        assert self.tray.total() == 0

    def test_place_increments_count(self):
        card = make_card()
        self.tray.place(0, 0, card)
        assert self.tray.count(0, 0) == 1
        assert self.tray.total() == 1

    def test_clear_bin(self):
        card = make_card()
        self.tray.place(0, 0, card)
        self.tray.clear_bin(0, 0)
        assert self.tray.count(0, 0) == 0

    def test_invalid_bin_raises(self):
        with pytest.raises(ValueError):
            self.tray.place(99, 99, make_card())

    def test_render_ascii_runs(self, capsys):
        self.tray.place(0, 0, make_card(rarity="Common"))
        self.tray.render_ascii()
        out = capsys.readouterr().out
        assert "VIRTUAL TRAY" in out


# ── BinInventory tests ────────────────────────────────────────────────────────

class TestBinInventory:

    def test_add_and_count(self):
        inv = BinInventory(rows=4, cols=4)
        inv.add(0, 0, make_card())
        assert inv.count(0, 0) == 1
        assert inv.total_cards() == 1

    def test_clear_bin(self):
        inv = BinInventory(rows=4, cols=4)
        inv.add(1, 2, make_card())
        inv.clear_bin(1, 2)
        assert inv.count(1, 2) == 0

    def test_fullest_bin(self):
        inv = BinInventory(rows=4, cols=4)
        for _ in range(5):
            inv.add(2, 3, make_card())
        inv.add(0, 0, make_card())
        r, c, count = inv.fullest_bin()
        assert (r, c) == (2, 3)
        assert count == 5

    def test_save_and_load(self, tmp_path):
        inv = BinInventory(rows=4, cols=4)
        inv.add(0, 1, make_card(name="Goblin"))
        save_file = str(tmp_path / "inv_test.json")
        inv.save(save_file)

        inv2 = BinInventory(rows=4, cols=4)
        inv2.load(save_file)
        assert inv2.count(0, 1) == 1


# ── Full pipeline integration test ───────────────────────────────────────────

class TestFullPipeline:

    def test_simulate_batch(self, tmp_path):
        """Run 10 synthetic cards through the full simulation pipeline."""
        import json
        cards = [
            make_card("Lightning Bolt",    rarity="Common",   confidence=0.97),
            make_card("Counterspell",      rarity="Common",   confidence=0.93),
            make_card("Dark Ritual",       rarity="Common",   confidence=0.91),
            make_card("Giant Growth",      rarity="Common",   confidence=0.88),
            make_card("Shock",             rarity="Common",   confidence=0.99),
            make_card("Grizzly Bears",     rarity="Common",   confidence=0.95),
            make_card("Cancel",            rarity="Uncommon", confidence=0.90),
            make_card("Murder",            rarity="Uncommon", confidence=0.87),
            make_card("Wrath of God",      rarity="Rare",     confidence=0.94),
            make_card("Black Lotus",       rarity="Mythic Rare", confidence=0.72),  # low confidence
        ]
        input_file = str(tmp_path / "test_cards.json")
        with open(input_file, "w") as f:
            json.dump(cards, f)

        sim = Simulator(
            grid_name="4x4",
            profile_name="by_rarity",
            bin_capacity=20,
            confidence_threshold=0.85,
            output_dir=str(tmp_path / "sessions"),
        )
        sim.run_from_json(input_file)

        assert len(sim.results) == 10

        # Black Lotus (confidence 0.72) should be in review bin
        lotus_result = next(r for r in sim.results if r["card"]["name"] == "Black Lotus")
        grid = GridLayout.load("4x4")
        assert (lotus_result["bin_row"], lotus_result["bin_col"]) == grid.review_bin()

        # Lightning Bolt (Common, confidence 0.97) should be in row 0
        bolt_result = next(r for r in sim.results if r["card"]["name"] == "Lightning Bolt")
        assert bolt_result["bin_row"] == 0

        # Wrath of God (Rare) should be in row 2
        wrath_result = next(r for r in sim.results if r["card"]["name"] == "Wrath of God")
        assert wrath_result["bin_row"] == 2
