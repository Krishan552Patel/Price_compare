"""
Machine — Mock Interface
Simulation-mode hardware driver.
Implements every method of HardwareInterface by logging instead of
moving real hardware.  Drop-in replacement for any real driver.
"""

import logging
from .hardware_interface import HardwareInterface

logger = logging.getLogger(__name__)


class MockInterface(HardwareInterface):
    """
    Fake hardware that logs every action.
    Used by Simulator so the full pipeline runs without any machine attached.
    """

    def __init__(self):
        self._position       = (None, None)
        self._initialized    = False
        self._move_count     = 0
        self._drop_count     = 0

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def initialize(self):
        self._initialized = True
        logger.info("[MOCK] Hardware initialized — simulation mode.")

    def shutdown(self):
        self._initialized = False
        logger.info(
            "[MOCK] Hardware shutdown. Moves: %d  Drops: %d",
            self._move_count, self._drop_count,
        )

    # ── motion ────────────────────────────────────────────────────────────────

    def home(self):
        self._position = (0, 0)
        logger.info("[MOCK] Homed → (0, 0)")

    def move_to_bin(self, row: int, col: int):
        self._position = (row, col)
        self._move_count += 1
        logger.debug("[MOCK] Move → bin (%d, %d)", row, col)

    def drop_card(self):
        self._drop_count += 1
        r, c = self._position
        logger.debug("[MOCK] Drop at bin (%s, %s)", r, c)

    # ── status ────────────────────────────────────────────────────────────────

    def current_position(self) -> tuple:
        return self._position

    def is_ready(self) -> bool:
        return self._initialized

    # ── stats ─────────────────────────────────────────────────────────────────

    @property
    def move_count(self) -> int:
        return self._move_count

    @property
    def drop_count(self) -> int:
        return self._drop_count
