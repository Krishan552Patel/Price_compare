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

export function FoilingBadge({
  foiling,
  foilingName,
}: {
  foiling: string | null;
  foilingName: string | null;
}) {
  if (!foiling && !foilingName) return null;

  // Abbreviation mapping: S→NF, R→RF, C→CF, G→GCF
  const foilingAbbrev: Record<string, string> = {
    S: "NF",
    R: "RF",
    C: "CF",
    G: "GCF",
  };

  const displayName = foilingAbbrev[foiling || ""] || foilingName || foiling || "";

  // Map foiling IDs to distinct visual styles
  const foilingStyles: Record<string, { classes: string; icon: string }> = {
    S: {
      classes: "bg-gray-700 text-gray-300",
      icon: "",
    },
    R: {
      classes: "bg-gradient-to-r from-pink-600 via-purple-500 to-blue-500 text-white",
      icon: "\u2728",
    },
    C: {
      classes: "bg-gradient-to-r from-cyan-600 to-blue-700 text-cyan-100",
      icon: "\u2744\uFE0F",
    },
    G: {
      classes: "bg-gradient-to-r from-yellow-500 to-amber-600 text-yellow-100",
      icon: "\u2B50",
    },
  };

  const style = foilingStyles[foiling || ""] || {
    classes: "bg-gray-700 text-gray-300",
    icon: "",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.classes}`}
    >
      {style.icon && <span>{style.icon}</span>}
      {displayName}
    </span>
  );
}
