/**
 * Normalise a compact card-ID query so users don't need to type leading zeros.
 *   "WTR01"  → "WTR001"   (1-2 trailing digits get zero-padded to 3)
 *   "ARC1"   → "ARC001"
 *   "1HP41"  → "1HP041"
 *   "WTR001" → "WTR001"   (already 3 digits — unchanged)
 *   "1HP141" → "1HP141"   (already 3 digits — unchanged)
 *   "brothers in arms" → unchanged (no trailing 1-2 digit pattern)
 *
 * Spaces are stripped before matching so "WTR 01" → "WTR001" too.
 */
export function normalizeCardId(q: string): string {
  const stripped = q.replace(/\s+/g, "");
  const m = stripped.match(/^([A-Za-z0-9]*[A-Za-z])(\d{1,2})$/i);
  return m ? m[1].toUpperCase() + m[2].padStart(3, "0") : q;
}

export function formatPrice(cad: number): string {
  return `$${cad.toFixed(2)}`;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value || value === "null") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getColorClass(color: string | null): string {
  switch (color) {
    case "red":
      return "bg-red-600";
    case "yellow":
      return "bg-yellow-500";
    case "blue":
      return "bg-blue-600";
    default:
      return "bg-gray-600";
  }
}

export function getColorTextClass(color: string | null): string {
  switch (color) {
    case "red":
      return "text-red-400";
    case "yellow":
      return "text-yellow-400";
    case "blue":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
}

export function getRetailerColor(slug: string): string {
  switch (slug) {
    case "invasion":
      return "#ef4444";
    case "gobelin":
      return "#3b82f6";
    case "etb":
      return "#10b981";
    default:
      return "#6b7280";
  }
}
