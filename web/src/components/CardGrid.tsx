import Link from "next/link";
import CardImage from "./CardImage";
import { ColorBadge } from "./Badge";
import type { Card } from "@/lib/types";

export default function CardGrid({ cards }: { cards: Card[] }) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No cards found</p>
        <p className="text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Link
          key={card.unique_id}
          href={`/cards/${card.unique_id}`}
          className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-600 transition group"
        >
          <div className="aspect-[5/7] relative overflow-hidden">
            <CardImage
              src={card.image_url}
              alt={card.name}
              width={250}
              height={350}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>
          <div className="p-3">
            <h3 className="font-semibold text-sm text-white truncate">
              {card.name}
            </h3>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {card.type_text}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <ColorBadge color={card.color} />
              {card.pitch && (
                <span className="text-xs text-gray-500">
                  Pitch: {card.pitch}
                </span>
              )}
              {card.lowest_price != null && (
                <span className="text-xs font-bold text-green-400 ml-auto">
                  ${card.lowest_price.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
