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
