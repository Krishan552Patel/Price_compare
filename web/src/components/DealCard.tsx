import Link from "next/link";
import type { DealItem } from "@/lib/types";
import { formatPrice, getRetailerColor } from "@/lib/utils";
import CardImage from "./CardImage";

export default function DealCard({ deal }: { deal: DealItem }) {
  const savings = deal.compare_at_price_cad - deal.price_cad;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-600 transition">
      <Link href={`/cards/${deal.card_unique_id}`}>
        <div className="aspect-[5/7] relative overflow-hidden">
          <CardImage
            src={deal.image_url}
            alt={deal.card_name}
            width={250}
            height={350}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            {deal.discount_pct}% OFF
          </div>
        </div>
      </Link>
      <div className="p-3">
        <Link href={`/cards/${deal.card_unique_id}`}>
          <h3 className="font-semibold text-white truncate hover:text-red-400 transition">
            {deal.card_name}
          </h3>
        </Link>
        <p className="text-xs text-gray-500 mt-0.5">{deal.card_id}</p>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-lg font-bold text-green-400">
            {formatPrice(deal.price_cad)}
          </span>
          <span className="text-sm text-gray-500 line-through">
            {formatPrice(deal.compare_at_price_cad)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Save {formatPrice(savings)}
        </p>

        <div className="flex items-center justify-between mt-3">
          <span
            className="text-xs font-medium"
            style={{ color: getRetailerColor(deal.retailer_slug) }}
          >
            {deal.retailer_name}
          </span>
          <a
            href={deal.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-red-500 hover:text-red-400"
          >
            Buy →
          </a>
        </div>
      </div>
    </div>
  );
}
