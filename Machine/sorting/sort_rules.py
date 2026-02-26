"""
Sorting — Sort Rules
Loads a sort profile from config/sort_profiles.yaml and determines
which zone a given enriched card record belongs to.

Each profile drives the logic here through config alone — you should
not need to touch this file when adding new profiles.
"""

import logging
from pathlib import Path
from typing import Optional

try:
    import yaml
except ImportError:
    raise ImportError("pyyaml is required. Install with: pip install pyyaml")

logger = logging.getLogger(__name__)

_DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "config" / "sort_profiles.yaml"

# ── PLUG IN: price tier thresholds (CAD) ─────────────────────────────────────
# Used by the 'by_value' sort profile.  Adjust these to match how you
# want to bucket card values into tray zones.
PRICE_TIERS = [
    (0.00, 0.49,  "bulk"),
    (0.50, 1.99,  "low"),
    (2.00, 9.99,  "mid"),
    (10.0, 9999,  "high"),
]


class SortRules:
    """
    Determines the zone name for an enriched card record.

    Usage
    -----
    rules = SortRules.load("by_rarity")
    zone  = rules.get_zone(enriched_card)   # → "common" | "rare" | "review" | …
    """

    def __init__(self, profile_name: str, profile: dict, global_cfg: dict):
        self.name           = profile_name
        self.description    = profile.get("description", "")
        self.sort_keys      = profile.get("sort_keys", [])
        self.foil_override  = profile.get("foil_override", False)
        self.zone_rules     = profile.get("zone_rules", {})
        self.default_zone   = profile.get("default_zone", "overflow")

        # global rarity/color translation maps from top of yaml
        self._rarity_map = global_cfg.get("rarity_map", {})
        self._color_map  = global_cfg.get("color_map", {})

    # ── factory ──────────────────────────────────────────────────────────────

    @classmethod
    def load(
        cls,
        profile_name: str,
        config_path: Optional[Path] = None,
    ) -> "SortRules":
        path = config_path or _DEFAULT_CONFIG_PATH
        with open(path) as f:
            data = yaml.safe_load(f)
        profiles = data.get("profiles", {})
        if profile_name not in profiles:
            available = list(profiles.keys())
            raise ValueError(
                f"Sort profile {profile_name!r} not found in {path}. "
                f"Available: {available}"
            )
        return cls(profile_name, profiles[profile_name], data)

    # ── main entry point ─────────────────────────────────────────────────────

    def get_zone(self, card: dict) -> str:
        """
        Return the zone name this card should be sorted into.
        Always returns a string — falls back to 'overflow' if no rule matches.
        """
        # Cards flagged by the confidence threshold always go to review.
        if card.get("needs_review"):
            return "review"

        # Foil override: if enabled and card is foil, bypass rarity sort.
        if self.foil_override and self._is_foil(card):
            return "foil"

        # Walk sort keys in order, return on first match.
        for key in self.sort_keys:
            zone = self._apply_key(key, card)
            if zone:
                return zone

        logger.debug(
            "No zone match for card %r — using default_zone %r",
            card.get("name"), self.default_zone,
        )
        return self.default_zone

    # ── internal helpers ─────────────────────────────────────────────────────

    def _apply_key(self, key: str, card: dict) -> Optional[str]:
        """Dispatch to the correct rule-matching method for a sort key."""
        if key == "rarity":
            return self._match_rarity(card)
        if key == "color" or key == "color_identity":
            return self._match_color(card, key)
        if key in ("rarity", "color"):
            return self._match_rarity_color(card)
        if key == "set_id":
            return self._match_set(card)
        if key == "price_cad":
            return self._match_price(card)
        logger.warning("Unknown sort key %r — skipping.", key)
        return None

    def _match_rarity(self, card: dict) -> Optional[str]:
        """Translate CNN rarity string → normalised key → zone."""
        raw = card.get("rarity") or card.get("db_rarity") or ""
        normalised = self._rarity_map.get(raw, raw.lower().replace(" ", "_"))
        rules = self.zone_rules.get("rarity", {})
        zone = rules.get(normalised)
        if not zone:
            logger.debug("Rarity %r (normalised: %r) not in rarity rules.", raw, normalised)
        return zone

    def _match_color(self, card: dict, key: str) -> Optional[str]:
        """
        Determine colour zone.

        ════════════════════════════════════════════════════════════════
        PLUG IN:
          Multi-colour logic: if a card has more than one colour in
          color_identity, it goes to 'multi'. Adjust the threshold or
          logic if needed.
        ════════════════════════════════════════════════════════════════
        """
        identity = card.get("color_identity") or card.get("colors") or []
        if not identity:
            normalised = "colorless"
        elif len(identity) > 1:
            normalised = "multi"
        else:
            raw = identity[0] if isinstance(identity, list) else identity
            normalised = self._color_map.get(raw, raw.lower())

        rules = self.zone_rules.get("color_identity", {})
        return rules.get(normalised)

    def _match_rarity_color(self, card: dict) -> Optional[str]:
        """Compound rarity+color key used by by_rarity_color profile."""
        raw_rarity = card.get("rarity") or card.get("db_rarity") or ""
        rarity_norm = self._rarity_map.get(raw_rarity, raw_rarity.lower())

        identity = card.get("color_identity") or card.get("colors") or []
        if not identity:
            color_norm = "colorless"
        elif len(identity) > 1:
            color_norm = "multi"
        else:
            raw = identity[0] if isinstance(identity, list) else identity
            color_norm = self._color_map.get(raw, raw.lower())

        compound = f"{rarity_norm}_{color_norm}"
        compound_any = f"{rarity_norm}_any"

        rules = self.zone_rules.get("rarity_color", {})
        return rules.get(compound) or rules.get(compound_any)

    def _match_set(self, card: dict) -> Optional[str]:
        set_id = card.get("cnn_set_id") or card.get("db_set_id") or ""
        rules = self.zone_rules.get("set_id", {})
        return rules.get(set_id)

    def _match_price(self, card: dict) -> Optional[str]:
        price = card.get("price_cad")
        if price is None:
            return None
        for low, high, tier in PRICE_TIERS:
            if low <= float(price) <= high:
                rules = self.zone_rules.get("price_tier", {})
                return rules.get(tier)
        return None

    @staticmethod
    def _is_foil(card: dict) -> bool:
        """
        Return True if the card is foil.

        ════════════════════════════════════════════════════════════════
        PLUG IN:
          Confirm which foil codes your CNN uses.
          Current assumption: "F" = foil, "S" = standard (non-foil).
          If your CNN uses "Foil"/"NonFoil" or True/False, adjust here.
        ════════════════════════════════════════════════════════════════
        """
        foiling = card.get("cnn_foiling") or card.get("db_foiling") or ""
        return str(foiling).upper() not in ("", "S", "N", "NONE", "FALSE", "NON-FOIL")

    def compatible_grids(self) -> list:
        """Return the list of grid configs this profile recommends."""
        # load lazily to avoid circular import
        path = _DEFAULT_CONFIG_PATH
        with open(path) as f:
            data = yaml.safe_load(f)
        profile = data.get("profiles", {}).get(self.name, {})
        return profile.get("compatible_grids", [])
