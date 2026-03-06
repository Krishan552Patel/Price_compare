"use client";

import { useState } from "react";
import type { Printing, RetailerPrice } from "@/lib/types";
import { FoilingBadge, RarityBadge } from "./Badge";
import PriceTable from "./PriceTable";

export default function CardPrintingsAndPrices({
  printings,
  prices,
  initialPrintingId,
}: {
  printings: Printing[];
  prices: RetailerPrice[];
  initialPrintingId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(initialPrintingId);

  function handleRowClick(printingId: string) {
    setSelectedId((prev) => (prev === printingId ? undefined : printingId));
  }

  return (
    <>
      {printings.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Printings ({printings.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left py-2 px-2">Card ID</th>
                  <th className="text-left py-2 px-2">Set</th>
                  <th className="text-left py-2 px-2">Edition</th>
                  <th className="text-left py-2 px-2">Foiling</th>
                  <th className="text-left py-2 px-2">Rarity</th>
                </tr>
              </thead>
              <tbody>
                {printings.map((p) => (
                  <tr
                    key={p.unique_id}
                    onClick={() => handleRowClick(p.unique_id)}
                    className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 transition select-none ${
                      selectedId === p.unique_id ? "bg-gray-800/70 ring-1 ring-inset ring-red-600/40" : ""
                    }`}
                  >
                    <td className="py-2 px-2 text-red-400 font-mono">{p.card_id}</td>
                    <td className="py-2 px-2 text-gray-300">{p.set_name || p.set_id}</td>
                    <td className="py-2 px-2 text-gray-300">{p.edition || "—"}</td>
                    <td className="py-2 px-2">
                      <FoilingBadge foiling={p.foiling} foilingName={p.foiling_name} />
                    </td>
                    <td className="py-2 px-2">
                      <RarityBadge rarity={p.rarity} rarityName={p.rarity_name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedId && (
            <p className="text-xs text-gray-500 mt-2">
              Showing prices for selected printing.{" "}
              <button
                onClick={() => setSelectedId(undefined)}
                className="text-red-400 hover:text-red-300 underline"
              >
                Show all
              </button>
            </p>
          )}
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">
          Price Comparison ({prices.length} listing{prices.length !== 1 ? "s" : ""})
        </h2>
        <PriceTable prices={prices} initialPrintingId={selectedId} />
      </section>
    </>
  );
}
