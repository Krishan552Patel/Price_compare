"""
Card Sorting Machine — Main Entry Point

Usage examples
--------------
# Run a simulation from a JSON file of enriched cards:
  python main.py simulate --input test_cards.json --grid 4x4 --profile by_rarity

# Run a simulation from a CSV:
  python main.py simulate --input cards.csv --grid 4x16 --profile by_rarity_color

# Print the zone map for a grid (no cards needed):
  python main.py map --grid 4x4

# Print all available grids and sort profiles:
  python main.py list

════════════════════════════════════════════════════════════════
PLUG IN — Live mode (future):
  When your hardware is ready, add a 'live' subcommand here that:
    1. Imports your real hardware interface (machine/real_interface.py)
    2. Opens a connection to the CNN repo (network call, subprocess,
       or shared queue — however Repo 2 feeds cards)
    3. Calls map_cnn_to_enriched() per card from the live CNN stream
    4. Passes each enriched card through BinAssigner
    5. Calls hardware.move_to_bin() + hardware.drop_card()
    6. Logs with SessionLogger

  Connection to CNN repo options:
    a) Python import  : if all repos live on the same machine, add
                        CNN repo to sys.path and import identify_card
    b) REST API       : CNN repo runs a Flask/FastAPI server, call it
    c) Message queue  : CNN publishes results to Redis/RabbitMQ channel
    d) File watch     : CNN writes results to a file, this script polls it

  ── PLUG IN: pick one of the above and implement in live mode ──
════════════════════════════════════════════════════════════════
"""

import argparse
import json
import logging
import sys
from pathlib import Path

# ── logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(name)s  %(message)s",
)
logger = logging.getLogger("main")


def cmd_simulate(args):
    from simulation.simulator import Simulator

    if not args.input:
        print("ERROR: --input is required for simulate mode.", file=sys.stderr)
        sys.exit(1)

    sim = Simulator(
        grid_name=args.grid,
        profile_name=args.profile,
        bin_capacity=args.capacity,
        confidence_threshold=args.confidence,
        output_dir=args.output_dir,
    )

    path = Path(args.input)
    if not path.exists():
        print(f"ERROR: Input file not found: {path}", file=sys.stderr)
        sys.exit(1)

    if path.suffix.lower() == ".json":
        sim.run_from_json(str(path))
    elif path.suffix.lower() == ".csv":
        sim.run_from_csv(str(path))
    else:
        print(f"ERROR: Unsupported file type {path.suffix}. Use .json or .csv", file=sys.stderr)
        sys.exit(1)

    sim.print_report(show_tray=True)

    if args.plot:
        sim.show_plot(save_path=args.plot_out)


def cmd_map(args):
    from sorting.grid_layout import GridLayout
    layout = GridLayout.load(args.grid)
    print(f"\nGrid: {layout.name}  ({layout.rows}×{layout.cols}  =  {layout.total_bins()} bins)")
    print(f"Description: {layout.description}\n")
    print(layout.ascii_map())
    print(f"\nZones ({len(layout.zone_names())}):")
    for z in layout.zone_names():
        label = layout.zone_label(z)
        bins  = layout.zone_bins(z)
        print(f"  {z:<25} → {label:<20} bins: {bins}")


def cmd_list(_args):
    import yaml
    from pathlib import Path

    cfg_dir = Path(__file__).parent / "config"

    print("\n── Available grids ─────────────────────────────────────────")
    with open(cfg_dir / "grid_configs.yaml") as f:
        grid_data = yaml.safe_load(f)
    for name, cfg in grid_data.get("grids", {}).items():
        print(f"  {name:<12} {cfg['rows']}×{cfg['cols']}  —  {cfg.get('description','')}")

    print("\n── Available sort profiles ─────────────────────────────────")
    with open(cfg_dir / "sort_profiles.yaml") as f:
        prof_data = yaml.safe_load(f)
    for name, prof in prof_data.get("profiles", {}).items():
        compat = ", ".join(prof.get("compatible_grids", []))
        print(f"  {name:<22} {prof.get('description','')}  [grids: {compat}]")
    print()


# ── argument parser ──────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="card_sorter",
        description="Card Sorting Machine — simulation and control",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # simulate
    sim_p = sub.add_parser("simulate", help="Run sort simulation from a file")
    sim_p.add_argument("--input",      required=True,  help="Path to .json or .csv card input file")
    sim_p.add_argument("--grid",       default="4x4",  help="Grid config name (default: 4x4)")
    sim_p.add_argument("--profile",    default="by_rarity", help="Sort profile name (default: by_rarity)")
    sim_p.add_argument("--capacity",   type=int, default=50, help="Max cards per bin (default: 50)")
    sim_p.add_argument("--confidence", type=float, default=0.85,
                       help="Min confidence to sort; below → review bin (default: 0.85)")
    sim_p.add_argument("--output-dir", default="sessions", help="Where to save session logs (default: sessions/)")
    sim_p.add_argument("--plot",       action="store_true", help="Show fill-level plot after simulation")
    sim_p.add_argument("--plot-out",   default=None, help="Save plot to this file instead of displaying")

    # map
    map_p = sub.add_parser("map", help="Print the zone→bin map for a grid")
    map_p.add_argument("--grid", default="4x4", help="Grid config name (default: 4x4)")

    # list
    sub.add_parser("list", help="List all available grids and sort profiles")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    dispatch = {
        "simulate": cmd_simulate,
        "map":      cmd_map,
        "list":     cmd_list,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
