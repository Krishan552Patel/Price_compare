import SearchBar from "@/components/SearchBar";
import { getStats } from "@/lib/queries";
import Link from "next/link";

// Revalidate every 5 minutes - stats don't change frequently
export const revalidate = 300;

export default async function HomePage() {
  let stats = { totalCards: 0, totalPrintings: 0, totalRetailerProducts: 0, retailers: 0 };

  try {
    stats = await getStats();
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
            label="In-Stock Listings"
            value={stats.totalRetailerProducts.toLocaleString()}
          />
          <Stat label="Stores" value={stats.retailers.toString()} />
        </div>
      </section>

      {/* Quick Links */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="text-center">
          <Link
            href="/cards"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            Browse All Cards
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
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
