import type { RetailerPrice } from "@/lib/types";
import { formatPrice, getRetailerColor } from "@/lib/utils";
import { StockBadge } from "./Badge";

export default function PriceTable({ prices }: { prices: RetailerPrice[] }) {
  if (prices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No price data available for this card</p>
      </div>
    );
  }

  const cheapest = prices.find((p) => p.in_stock)?.price_cad;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="text-left py-3 px-2">Store</th>
            <th className="text-left py-3 px-2">Variant</th>
            <th className="text-right py-3 px-2">Price</th>
            <th className="text-right py-3 px-2">Was</th>
            <th className="text-center py-3 px-2">Stock</th>
            <th className="text-right py-3 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {prices.map((price, i) => {
            const isCheapest =
              price.in_stock && price.price_cad === cheapest;
            return (
              <tr
                key={i}
                className={`border-b border-gray-800 ${!price.in_stock ? "opacity-50" : ""}`}
              >
                <td className="py-3 px-2">
                  <span
                    className="font-medium"
                    style={{ color: getRetailerColor(price.retailer_slug) }}
                  >
                    {price.retailer_name}
                  </span>
                </td>
                <td className="py-3 px-2 text-gray-300">
                  {price.card_id}
                </td>
                <td className="py-3 px-2 text-right">
                  <span
                    className={`font-bold ${isCheapest ? "text-green-400" : "text-white"}`}
                  >
                    {formatPrice(price.price_cad)}
                  </span>
                  {isCheapest && (
                    <span className="ml-1 text-xs text-green-500">
                      BEST
                    </span>
                  )}
                </td>
                <td className="py-3 px-2 text-right text-gray-500">
                  {price.compare_at_price_cad
                    ? formatPrice(price.compare_at_price_cad)
                    : "—"}
                </td>
                <td className="py-3 px-2 text-center">
                  <StockBadge inStock={price.in_stock} />
                </td>
                <td className="py-3 px-2 text-right">
                  <a
                    href={price.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-500 hover:text-red-400 text-xs"
                  >
                    Buy →
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
