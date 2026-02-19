import Link from "next/link";
import { PitchDot } from "./Badge";
import type { Card } from "@/lib/types";

export default function CardTable({ cards }: { cards: Card[] }) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No cards found</p>
        <p className="text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-left">
            <th className="py-3 px-3">Name</th>
            <th className="py-3 px-2">Pitch</th>
            <th className="py-3 px-2">Type</th>
            <th className="py-3 px-2 text-center">Cost</th>
            <th className="py-3 px-2 text-center">Power</th>
            <th className="py-3 px-2 text-center">Defense</th>
            <th className="py-3 px-2 text-center">Health</th>
            <th className="py-3 px-2 text-right">Price</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr
              key={card.unique_id}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition"
            >
              <td className="py-2.5 px-3">
                <Link
                  href={`/cards/${card.unique_id}`}
                  className="text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  {card.name}
                </Link>
              </td>
              <td className="py-2.5 px-2">
                <PitchDot pitch={card.pitch} />
              </td>
              <td className="py-2.5 px-2 text-gray-400 max-w-[200px] truncate">
                {card.type_text}
              </td>
              <td className="py-2.5 px-2 text-center text-gray-300">
                {card.cost !== null && card.cost !== "" ? card.cost : "—"}
              </td>
              <td className="py-2.5 px-2 text-center text-gray-300">
                {card.power !== null && card.power !== "" ? card.power : "—"}
              </td>
              <td className="py-2.5 px-2 text-center text-gray-300">
                {card.defense !== null && card.defense !== "" ? card.defense : "—"}
              </td>
              <td className="py-2.5 px-2 text-center text-gray-300">
                {card.health !== null && card.health !== "" ? card.health : "—"}
              </td>
              <td className="py-2.5 px-2 text-right">
                {card.lowest_price != null ? (
                  <span className="text-green-400 font-bold">
                    ${card.lowest_price.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
