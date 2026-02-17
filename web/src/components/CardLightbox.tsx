"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Card } from "@/lib/types";
import CardImage from "./CardImage";
import { PitchDot } from "./Badge";

export default function CardLightbox({
  card,
  onClose,
}: {
  card: Card;
  onClose: () => void;
}) {
  const router = useRouter();

  // Lock body scroll + handle Escape
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Content */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-gray-400 hover:text-white transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Card Image */}
        <div className="aspect-[5/7] relative">
          <CardImage
            src={card.image_url}
            alt={card.name}
            width={350}
            height={490}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-white mb-1">{card.name}</h3>
          {card.type_text && (
            <p className="text-sm text-gray-400 mb-3">{card.type_text}</p>
          )}

          <div className="flex items-center gap-3 mb-4">
            <PitchDot pitch={card.pitch} />
            {card.cost !== null && (
              <span className="text-xs text-gray-400">
                Cost: {card.cost}
              </span>
            )}
            {card.power !== null && (
              <span className="text-xs text-gray-400">
                Power: {card.power}
              </span>
            )}
            {card.defense !== null && (
              <span className="text-xs text-gray-400">
                Defense: {card.defense}
              </span>
            )}
            {card.lowest_price != null && (
              <span className="text-sm font-bold text-green-400 ml-auto">
                ${card.lowest_price.toFixed(2)}
              </span>
            )}
          </div>

          <button
            onClick={() => router.push(`/cards/${card.unique_id}`)}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 rounded-lg transition"
          >
            View Prices &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
