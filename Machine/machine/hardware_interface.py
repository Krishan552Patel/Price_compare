"""
Machine — Hardware Interface (Abstract Base)
All hardware control classes must inherit from this and implement
every abstract method.  The MockInterface does this for simulation.
Your real machine driver will do this for physical hardware.

════════════════════════════════════════════════════════════════
PLUG IN — Real Hardware (Repo 3 / future):
  Create a new file, e.g. machine/real_interface.py, with a class
  that inherits HardwareInterface and fills in every method marked
  PLUG IN below with your actual hardware control code.

  Typical options depending on your machine design:
    - Serial / UART  : import serial  (pyserial)
    - GPIO (Pi)      : import RPi.GPIO  or  gpiozero
    - Stepper motors : use stepper library of your choice
    - Arduino/CNC    : send G-code over serial
    - Custom PCB     : whatever protocol you design

  Then pass your real interface to the Sorter instead of MockInterface:
    from machine.real_interface import RealInterface
    sorter = Sorter(..., hardware=RealInterface())
════════════════════════════════════════════════════════════════
"""

from abc import ABC, abstractmethod


class HardwareInterface(ABC):
    """
    Abstract interface for the physical card sorting machine.

    The machine is expected to:
    1. Accept a target bin address (row, col).
    2. Move a mechanical arm/gate/diverter to that address.
    3. Drop/release the current card into the bin.
    4. Be able to home itself to a known reference position.
    5. Report its current position.
    """

    # ── lifecycle ─────────────────────────────────────────────────────────────

    @abstractmethod
    def initialize(self):
        """
        Open connection to hardware and run startup sequence.
        Called once at the start of a sort session.

        ════════════════════════════════════════════════════════════════
        PLUG IN: open serial port, initialise GPIO, send HELLO frame, etc.
        ════════════════════════════════════════════════════════════════
        """

    @abstractmethod
    def shutdown(self):
        """
        Safe shutdown: park the arm, close connection.
        Called once at the end of a sort session.

        ════════════════════════════════════════════════════════════════
        PLUG IN: send HOME command, close serial port, release GPIO, etc.
        ════════════════════════════════════════════════════════════════
        """

    # ── motion ────────────────────────────────────────────────────────────────

    @abstractmethod
    def home(self):
        """
        Move arm/head to the home/reference position.

        ════════════════════════════════════════════════════════════════
        PLUG IN: send homing G-code, trigger limit switches, etc.
        ════════════════════════════════════════════════════════════════
        """

    @abstractmethod
    def move_to_bin(self, row: int, col: int):
        """
        Move to the bin at (row, col) and stop, ready to drop.

        ════════════════════════════════════════════════════════════════
        PLUG IN: translate (row, col) into motor steps / coordinates
        for your machine geometry, then send the move command.

        Example for a belt-driven XY machine:
          x_mm = col * BIN_WIDTH_MM + BIN_OFFSET_X
          y_mm = row * BIN_HEIGHT_MM + BIN_OFFSET_Y
          serial.write(f"G1 X{x_mm} Y{y_mm} F3000\n".encode())

        Key physical parameters to define in your driver:
          BIN_WIDTH_MM   — horizontal distance between bin centres
          BIN_HEIGHT_MM  — vertical distance between bin centres
          BIN_OFFSET_X   — X position of bin (0,0)
          BIN_OFFSET_Y   — Y position of bin (0,0)
        ════════════════════════════════════════════════════════════════
        """

    @abstractmethod
    def drop_card(self):
        """
        Release the card into the current bin.

        ════════════════════════════════════════════════════════════════
        PLUG IN: actuate servo / solenoid / belt diverter to drop card.
        ════════════════════════════════════════════════════════════════
        """

    # ── status ────────────────────────────────────────────────────────────────

    @abstractmethod
    def current_position(self) -> tuple:
        """
        Return the current (row, col) the hardware believes it is at.
        Returns (None, None) if position is unknown.

        ════════════════════════════════════════════════════════════════
        PLUG IN: query encoder / step counter / firmware position report.
        ════════════════════════════════════════════════════════════════
        """

    @abstractmethod
    def is_ready(self) -> bool:
        """
        Return True if the machine is connected and ready to accept a move.

        ════════════════════════════════════════════════════════════════
        PLUG IN: ping firmware, check serial connection, poll status pin.
        ════════════════════════════════════════════════════════════════
        """

    # ── context manager support ──────────────────────────────────────────────

    def __enter__(self):
        self.initialize()
        return self

    def __exit__(self, *_):
        self.shutdown()
