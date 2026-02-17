import SearchBar from "@/components/SearchBar";
import { getStats, getDeals } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stats = { totalCards: 0, totalPrintings: 0, totalRetailerProducts: 0, retailers: 0 };
  let deals: Awaited<ReturnType<typeof getDeals>> = [];

  try {
    [stats, deals] = await Promise.all([getStats(), getDeals({ limit: 6 })]);
  } catch (e) {
    console.error("Failed to load home page data:", e);
  }

  return (
    <div>
      {/* Hero */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-red-500">FAB</span> Price Tracker
          </h1>
          <p className="text-gray-400 mb-8">
            Compare Flesh and Blood card prices across Canadian retailers
          </p>
          <SearchBar large />
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Cards" value={stats.totalCards.toLocaleString()} />
          <Stat
            label="Printings"
            value={stats.totalPrintings.toLocaleString()}
          />
          <Stat
            label="Price Listings"
            value={stats.totalRetailerProducts.toLocaleString()}
          />
          <Stat label="Stores" value={stats.retailers.toString()} />
        </div>
      </section>

      {/* Latest Deals Preview */}
      {deals.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Top Deals</h2>
            <Link
              href="/deals"
              className="text-red-500 hover:text-red-400 text-sm"
            >
              View all deals →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deals.map((deal, i) => (
              <Link
                key={i}
                href={`/cards/${deal.card_unique_id}`}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white">{deal.card_name}</h3>
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded shrink-0 ml-2">
                    {deal.discount_pct}% OFF
                  </span>
                </div>
                <p className="text-sm text-gray-400">{deal.card_id}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-lg font-bold text-green-400">
                    {formatPrice(deal.price_cad)}
                  </span>
                  <span className="text-sm text-gray-500 line-through">
                    {formatPrice(deal.compare_at_price_cad)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {deal.retailer_name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}
