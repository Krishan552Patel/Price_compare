"""
Simulation — Virtual Tray
Holds in-memory state of every bin and renders it to the terminal
as an ASCII grid.  Optionally renders a matplotlib heat-map.
"""

import logging
from typing import Optional

from sorting.grid_layout import GridLayout

logger = logging.getLogger(__name__)

# Fill-level symbols for ASCII colour-coded display
_FILL_SYMBOLS = [" ", "░", "▒", "▓", "█"]


class VirtualTray:
    """
    Simulates a physical tray of bins.

    Usage
    -----
    tray = VirtualTray(grid=GridLayout.load("4x4"), bin_capacity=50)
    tray.place(row=0, col=1, card=enriched)
    tray.render_ascii()
    tray.render_plot()    # requires matplotlib
    """

    def __init__(self, grid: GridLayout, bin_capacity: int = 50):
        self.grid         = grid
        self.bin_capacity = bin_capacity
        # { (row, col): [enriched_card, ...] }
        self._bins: dict  = {
            (r, c): [] for r in range(grid.rows) for c in range(grid.cols)
        }

    # ── mutation ─────────────────────────────────────────────────────────────

    def place(self, row: int, col: int, card: dict):
        if not self.grid.is_valid_bin(row, col):
            raise ValueError(f"Bin ({row},{col}) is out of range for {self.grid}.")
        self._bins[(row, col)].append(card)

        count = len(self._bins[(row, col)])
        if count >= self.bin_capacity:
            logger.warning(
                "Bin (%d,%d) is at/over capacity (%d/%d). "
                "Consider emptying or increasing bin_capacity.",
                row, col, count, self.bin_capacity,
            )

    def clear_bin(self, row: int, col: int):
        self._bins[(row, col)] = []

    def clear_all(self):
        for key in self._bins:
            self._bins[key] = []

    # ── queries ──────────────────────────────────────────────────────────────

    def count(self, row: int, col: int) -> int:
        return len(self._bins.get((row, col), []))

    def total(self) -> int:
        return sum(len(cards) for cards in self._bins.values())

    def fill_pct(self, row: int, col: int) -> float:
        return self.count(row, col) / self.bin_capacity

    def cards_in(self, row: int, col: int) -> list:
        return list(self._bins.get((row, col), []))

    # ── ASCII rendering ──────────────────────────────────────────────────────

    def render_ascii(self, show_zone_labels: bool = True):
        """
        Print the tray state to stdout as an ASCII grid.
        Each cell shows: count / capacity  and the zone label if available.
        """
        # build zone label lookup
        zone_label_for: dict = {}
        if show_zone_labels:
            for zone in self.grid.zone_names():
                label = self.grid.zone_label(zone)[:8]
                for rc in self.grid.zone_bins(zone):
                    zone_label_for[tuple(rc)] = label

        cell_w = 14
        total_w = 5 + cell_w * self.grid.cols

        print()
        print("═" * total_w)
        print(f"  VIRTUAL TRAY  [{self.grid.name}]  "
              f"total={self.total()}  capacity/bin={self.bin_capacity}")
        print("═" * total_w)

        # column header
        hdr = "     " + "".join(f" col{c:<{cell_w-4}}" for c in range(self.grid.cols))
        print(hdr)
        print("─" * total_w)

        for r in range(self.grid.rows):
            # zone labels row
            label_line = "     "
            for c in range(self.grid.cols):
                label = zone_label_for.get((r, c), "")
                label_line += f"[{label:^{cell_w-2}}]"

            # count row
            count_line = f" r{r:>2}  "
            for c in range(self.grid.cols):
                cnt = self.count(r, c)
                pct = self.fill_pct(r, c)
                symbol = _FILL_SYMBOLS[min(int(pct * 4), 4)]
                count_line += f"[{symbol}{cnt:>3}/{self.bin_capacity:<3}{symbol}]"

            print(label_line)
            print(count_line)
            if r < self.grid.rows - 1:
                print("─" * total_w)

        print("═" * total_w)
        print()

    # ── matplotlib rendering ─────────────────────────────────────────────────

    def render_plot(self, title: Optional[str] = None, save_path: Optional[str] = None):
        """
        Render a heat-map of fill levels using matplotlib.
        Requires: pip install matplotlib

        ════════════════════════════════════════════════════════════════
        PLUG IN: adjust figure size (figsize) to match your screen or
        the aspect ratio of your physical tray.
        ════════════════════════════════════════════════════════════════
        """
        try:
            import matplotlib.pyplot as plt
            import matplotlib.colors as mcolors
            import numpy as np
        except ImportError:
            logger.warning(
                "matplotlib/numpy not installed — skipping plot render. "
                "Install with: pip install matplotlib numpy"
            )
            return

        data = np.zeros((self.grid.rows, self.grid.cols))
        for r in range(self.grid.rows):
            for c in range(self.grid.cols):
                data[r, c] = self.fill_pct(r, c)

        fig, ax = plt.subplots(figsize=(max(8, self.grid.cols), max(4, self.grid.rows)))
        cmap = plt.cm.RdYlGn_r   # green=empty, red=full
        im = ax.imshow(data, cmap=cmap, vmin=0, vmax=1)
        plt.colorbar(im, ax=ax, label="Fill level")

        # annotate each cell with count
        for r in range(self.grid.rows):
            for c in range(self.grid.cols):
                cnt = self.count(r, c)
                ax.text(c, r, str(cnt), ha="center", va="center", fontsize=8)

        ax.set_xticks(range(self.grid.cols))
        ax.set_yticks(range(self.grid.rows))
        ax.set_xticklabels([f"col{c}" for c in range(self.grid.cols)])
        ax.set_yticklabels([f"row{r}" for r in range(self.grid.rows)])
        ax.set_title(title or f"Virtual Tray — {self.grid.name}")

        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=150)
            logger.info("Tray plot saved to %s", save_path)
        else:
            plt.show()
        plt.close()
