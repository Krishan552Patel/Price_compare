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
