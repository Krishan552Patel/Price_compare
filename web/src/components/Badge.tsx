export function ColorBadge({ color }: { color: string | null }) {
  if (!color) return null;
  const colorMap: Record<string, string> = {
    red: "bg-red-600 text-white",
    yellow: "bg-yellow-500 text-black",
    blue: "bg-blue-600 text-white",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${colorMap[color] || "bg-gray-600 text-white"}`}
    >
      {color}
    </span>
  );
}

export function LegalBadge({
  label,
  legal,
}: {
  label: string;
  legal: boolean;
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${legal ? "bg-green-800 text-green-200" : "bg-gray-700 text-gray-500"}`}
    >
      {label}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: string | null }) {
  if (!rarity) return null;
  const rarityColors: Record<string, string> = {
    common: "bg-gray-600 text-gray-200",
    rare: "bg-blue-700 text-blue-200",
    super_rare: "bg-purple-700 text-purple-200",
    majestic: "bg-yellow-600 text-yellow-100",
    legendary: "bg-orange-600 text-orange-100",
    fabled: "bg-red-700 text-red-200",
    marvel: "bg-pink-700 text-pink-200",
  };
  const displayName = rarity.replace(/_/g, " ");
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${rarityColors[rarity] || "bg-gray-600 text-gray-200"}`}
    >
      {displayName}
    </span>
  );
}

export function StockBadge({ inStock }: { inStock: boolean }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${inStock ? "bg-green-800 text-green-200" : "bg-red-900 text-red-300"}`}
    >
      {inStock ? "In Stock" : "Out of Stock"}
    </span>
  );
}

export function PitchDot({ pitch }: { pitch: string | null }) {
  if (!pitch) return null;
  const dotColors: Record<string, string> = {
    "1": "bg-red-500",
    "2": "bg-yellow-400",
    "3": "bg-blue-500",
  };
  const color = dotColors[pitch];
  if (!color) return null;
  return <span className={`inline-block w-3 h-3 rounded-full ${color}`} />;
}

export function ConditionBadge({ condition }: { condition: string }) {
  const conditionStyles: Record<string, { classes: string; label: string }> = {
    NM: {
      classes: "bg-green-800 text-green-200",
      label: "NM",
    },
    LP: {
      classes: "bg-lime-800 text-lime-200",
      label: "LP",
    },
    MP: {
      classes: "bg-yellow-800 text-yellow-200",
      label: "MP",
    },
    HP: {
      classes: "bg-orange-800 text-orange-200",
      label: "HP",
    },
    DMG: {
      classes: "bg-red-800 text-red-200",
      label: "DMG",
    },
  };

  const style = conditionStyles[condition] || conditionStyles.NM;

  const fullLabels: Record<string, string> = {
    NM: "Near Mint",
    LP: "Lightly Played",
    MP: "Moderately Played",
    HP: "Heavily Played",
    DMG: "Damaged",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style.classes}`}
      title={fullLabels[condition] || condition}
    >
      {style.label}
    </span>
  );
}

export function FoilingBadge({
  foiling,
  foilingName,
}: {
  foiling: string | null;
  foilingName: string | null;
}) {
  if (!foiling && !foilingName) return null;

  // Abbreviation mapping: S→NF, R→RF, C→CF, G→GF
  const foilingAbbrev: Record<string, string> = {
    S: "NF",
    R: "RF",
    C: "CF",
    G: "GF",
  };

  const displayName = foilingAbbrev[foiling || ""] || foilingName || foiling || "";

  // Map foiling IDs to distinct visual styles (no icons, just colors)
  const foilingStyles: Record<string, string> = {
    S: "bg-gray-700 text-gray-300",           // NF - silver/gray
    R: "bg-gradient-to-r from-pink-600 via-purple-500 to-blue-500 text-white",  // RF - rainbow
    C: "bg-blue-700 text-blue-100",           // CF - blue
    G: "bg-gradient-to-r from-yellow-500 to-amber-600 text-yellow-100",  // GCF - gold
  };

  const classes = foilingStyles[foiling || ""] || "bg-gray-700 text-gray-300";

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
      {displayName}
    </span>
  );
}
