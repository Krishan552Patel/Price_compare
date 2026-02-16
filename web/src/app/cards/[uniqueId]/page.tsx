import { notFound } from "next/navigation";
import { getCard, getCardPrintings, getCardPrices } from "@/lib/queries";
import CardImage from "@/components/CardImage";
import { ColorBadge, LegalBadge } from "@/components/Badge";
import PriceTable from "@/components/PriceTable";
import PriceChart from "@/components/PriceChart";

export const revalidate = 3600;

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ uniqueId: string }>;
}) {
  const { uniqueId } = await params;

  const [card, printings, prices] = await Promise.all([
    getCard(uniqueId),
    getCardPrintings(uniqueId),
    getCardPrices(uniqueId),
  ]);

  if (!card) notFound();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Card Header */}
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        {/* Image */}
        <div className="md:w-72 shrink-0">
          <CardImage
            src={card.image_url}
            alt={card.name}
            width={288}
            height={400}
            className="w-full"
          />
        </div>

        {/* Info */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{card.name}</h1>
          <p className="text-gray-400 mb-4">{card.type_text}</p>

          {/* Stats */}
          <div className="flex flex-wrap gap-3 mb-4">
            <ColorBadge color={card.color} />
            {card.pitch !== null && (
              <StatPill label="Pitch" value={card.pitch} />
            )}
            {card.cost !== null && (
              <StatPill label="Cost" value={card.cost} />
            )}
            {card.power !== null && (
              <StatPill label="Power" value={card.power} />
            )}
            {card.defense !== null && (
              <StatPill label="Defense" value={card.defense} />
            )}
            {card.health !== null && (
              <StatPill label="Health" value={card.health} />
            )}
            {card.intelligence !== null && (
              <StatPill label="Intelligence" value={card.intelligence} />
            )}
          </div>

          {/* Card Text */}
          {card.functional_text_plain && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {card.functional_text_plain}
              </p>
            </div>
          )}

          {/* Legality */}
          <div className="flex flex-wrap gap-2 mb-4">
            <LegalBadge label="Blitz" legal={!!card.blitz_legal} />
            <LegalBadge label="CC" legal={!!card.cc_legal} />
            <LegalBadge label="Commoner" legal={!!card.commoner_legal} />
            <LegalBadge label="LL" legal={!!card.ll_legal} />
          </div>

          {/* Keywords */}
          {card.card_keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {card.card_keywords.map((kw) => (
                <span
                  key={kw}
                  className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Printings */}
      {printings.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">
            Printings ({printings.length})
          </h2>
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
                  <tr key={p.unique_id} className="border-b border-gray-800">
                    <td className="py-2 px-2 text-white font-mono">
                      {p.card_id}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {p.set_name || p.set_id}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {p.edition || "—"}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {p.foiling_name || p.foiling || "—"}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {p.rarity_name || p.rarity || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Price Comparison */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4">
          Price Comparison ({prices.length} listing{prices.length !== 1 ? "s" : ""})
        </h2>
        <PriceTable prices={prices} />
      </section>

      {/* Price History Chart */}
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4">Price History</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <PriceChart cardUniqueId={uniqueId} />
        </div>
      </section>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
      {label}: {value}
    </span>
  );
}
