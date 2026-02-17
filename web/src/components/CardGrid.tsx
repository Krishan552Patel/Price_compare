"use client";

import { useState } from "react";
import CardImage from "./CardImage";
import { PitchDot } from "./Badge";
import CardLightbox from "./CardLightbox";
import type { Card } from "@/lib/types";

type Density = "few" | "regular" | "many" | "most";

const densityClasses: Record<Density, string> = {
  few: "grid-cols-2 lg:grid-cols-3",
  regular: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  many: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6",
  most: "grid-cols-4 sm:grid-cols-5 lg:grid-cols-8",
};

export default function CardGrid({
  cards,
  density = "regular",
}: {
  cards: Card[];
  density?: Density;
}) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const compact = density === "many" || density === "most";

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No cards found</p>
        <p className="text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <>
      <div className={`grid ${densityClasses[density]} gap-3`}>
        {cards.map((card) => (
          <button
            key={card.unique_id}
            onClick={() => setSelectedCard(card)}
            className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-600 transition group text-left"
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
            {compact ? (
              /* Compact mode: just pitch dot + price */
              <div className="px-2 py-1.5 flex items-center gap-1.5">
                <PitchDot pitch={card.pitch} />
                {card.lowest_price != null && (
                  <span className="text-xs font-bold text-green-400 ml-auto">
                    ${card.lowest_price.toFixed(2)}
                  </span>
                )}
              </div>
            ) : (
              /* Normal mode: full info */
              <div className="p-3">
                <h3 className="font-semibold text-sm text-white truncate">
                  {card.name}
                </h3>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {card.type_text}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <PitchDot pitch={card.pitch} />
                  {card.lowest_price != null && (
                    <span className="text-xs font-bold text-green-400 ml-auto">
                      ${card.lowest_price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedCard && (
        <CardLightbox
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  );
}
