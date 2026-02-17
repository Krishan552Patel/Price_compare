import { getDeals } from "@/lib/queries";
import DealCard from "@/components/DealCard";
import DealsToolbar from "@/components/DealsToolbar";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const retailer = params.retailer;
  const minDiscount = params.minDiscount ? parseInt(params.minDiscount, 10) : undefined;
  const sort = params.sort || "discount_desc";

  let deals: Awaited<ReturnType<typeof getDeals>> = [];

  try {
    deals = await getDeals({
      limit: 50,
      retailer,
      minDiscount,
      sort,
    });
  } catch (e) {
    console.error("Failed to load deals:", e);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Best Deals</h1>
      <p className="text-gray-400 mb-6">
        Cards with the biggest discounts from compare-at prices, currently in
        stock
      </p>

      <DealsToolbar
        currentRetailer={retailer}
        currentMinDiscount={params.minDiscount}
        currentSort={sort}
      />

      {deals.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No deals found</p>
          <p className="text-sm mt-2">
            Try adjusting your filters or check back after the next price scrape
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">
            {deals.length} deal{deals.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {deals.map((deal, i) => (
              <DealCard key={i} deal={deal} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
