import { getTrendingCards } from "@/lib/queries";
import TrendingClient from "./TrendingClient";

// Revalidate hourly — aligns with the MV refresh cadence (scraper runs 2x/day)
export const revalidate = 3600;

export default async function TrendingPage() {
  // Fetch default data server-side (7d / both / $1 min).
  // The MV makes this ~5ms DB call, so it barely adds to SSR time.
  // Result: the page arrives pre-populated — zero loading skeleton on first paint.
  const initialCards = await getTrendingCards({
    days: 7,
    direction: "both",
    minMove: 1,
  });

  return <TrendingClient initialCards={initialCards} />;
}
