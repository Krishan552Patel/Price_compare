import { getDeals } from "@/lib/queries";
import DealCard from "@/components/DealCard";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  let deals: Awaited<ReturnType<typeof getDeals>> = [];

  try {
    deals = await getDeals(50);
  } catch (e) {
    console.error("Failed to load deals:", e);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Best Deals</h1>
      <p className="text-gray-400 mb-8">
        Cards with the biggest discounts from compare-at prices, currently in
        stock
      </p>

      {deals.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No deals found right now</p>
          <p className="text-sm mt-2">
            Check back after the next price scrape
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {deals.map((deal, i) => (
            <DealCard key={i} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
