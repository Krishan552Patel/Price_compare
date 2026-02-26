"""
Sorting — Grid Layout
Loads a tray configuration from config/grid_configs.yaml and answers
questions like "which bins belong to zone X?" and "is (row, col) valid?".
"""

import logging
from pathlib import Path
from typing import Optional

try:
    import yaml
except ImportError:
    raise ImportError("pyyaml is required. Install with: pip install pyyaml")

logger = logging.getLogger(__name__)

_DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "config" / "grid_configs.yaml"


class GridLayout:
    """
    Represents a physical tray's bin layout.

    Usage
    -----
    layout = GridLayout.load("4x4")
    bins = layout.zone_bins("common")    # → [[0,0],[0,1],[0,2],[0,3]]
    ok   = layout.is_valid_bin(3, 3)     # → True / False
    """

    def __init__(self, name: str, config: dict):
        self.name          = name
        self.rows: int     = config["rows"]
        self.cols: int     = config["cols"]
        self.description   = config.get("description", "")
        self._overflow     = tuple(config["overflow_bin"])  # (row, col)
        self._zones: dict  = config.get("zones", {})

    # ── factory ──────────────────────────────────────────────────────────────

    @classmethod
    def load(
        cls,
        grid_name: str,
        config_path: Optional[Path] = None,
    ) -> "GridLayout":
        path = config_path or _DEFAULT_CONFIG_PATH
        with open(path) as f:
            data = yaml.safe_load(f)
        grids = data.get("grids", {})
        if grid_name not in grids:
            available = list(grids.keys())
            raise ValueError(
                f"Grid {grid_name!r} not found in {path}. "
                f"Available: {available}"
            )
        return cls(grid_name, grids[grid_name])

    # ── zone queries ─────────────────────────────────────────────────────────

    def zone_bins(self, zone_name: str) -> list:
        """
        Return list of [row, col] pairs for the named zone.
        Raises KeyError if the zone doesn't exist.
        """
        zone = self._zones.get(zone_name)
        if zone is None:
            raise KeyError(f"Zone {zone_name!r} not in grid {self.name!r}.")
        return zone["bins"]

    def first_bin_of_zone(self, zone_name: str) -> tuple:
        """Return (row, col) of the first bin in a zone."""
        bins = self.zone_bins(zone_name)
        return tuple(bins[0])

    def overflow_bin(self) -> tuple:
        """Return (row, col) of the overflow bin."""
        return self._overflow

    def review_bin(self) -> tuple:
        """
        Return (row, col) of the review bin.
        Falls back to overflow if no 'review' zone is defined.
        """
        if "review" in self._zones:
            return self.first_bin_of_zone("review")
        return self._overflow

    # ── validation ───────────────────────────────────────────────────────────

    def is_valid_bin(self, row: int, col: int) -> bool:
        return 0 <= row < self.rows and 0 <= col < self.cols

    def total_bins(self) -> int:
        return self.rows * self.cols

    def all_bins(self) -> list:
        """Return every valid (row, col) pair in row-major order."""
        return [(r, c) for r in range(self.rows) for c in range(self.cols)]

    def zone_names(self) -> list:
        return list(self._zones.keys())

    def zone_label(self, zone_name: str) -> str:
        return self._zones.get(zone_name, {}).get("label", zone_name)

    # ── display ──────────────────────────────────────────────────────────────

    def __repr__(self) -> str:
        return (
            f"GridLayout(name={self.name!r}, "
            f"rows={self.rows}, cols={self.cols}, "
            f"zones={len(self._zones)})"
        )

    def ascii_map(self) -> str:
        """
        Render a simple ASCII grid showing zone labels per bin.
        Useful for verifying your config before physical setup.
        """
        # build reverse map: (row, col) → zone_label
        bin_to_zone: dict = {}
        for zname, zdata in self._zones.items():
            for rc in zdata["bins"]:
                bin_to_zone[tuple(rc)] = zdata.get("label", zname)[:8]

        col_w = 12
        lines = []
        header = "     " + "".join(f" col{c:<{col_w-4}}" for c in range(self.cols))
        lines.append(header)
        sep = "     " + ("-" * col_w) * self.cols
        lines.append(sep)
        for r in range(self.rows):
            row_parts = []
            for c in range(self.cols):
                label = bin_to_zone.get((r, c), "")
                row_parts.append(f"[{label:^{col_w-2}}]")
            lines.append(f"row{r}  " + "".join(row_parts))
        return "\n".join(lines)
