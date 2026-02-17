import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCard,
  getCardPrintings,
  getCardPrices,
  getPrintingParent,
} from "@/lib/queries";
import CardImage from "@/components/CardImage";
import { ColorBadge, LegalBadge, PitchDot } from "@/components/Badge";
import PriceTable from "@/components/PriceTable";
import PriceChart from "@/components/PriceChart";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ uniqueId: string }>;
}) {
  const { uniqueId } = await params;

  // 1. Try to find the card directly
  let card = await getCard(uniqueId);
  let preSelectedPrintingId: string | undefined = undefined;

  // 2. If not found, check if it's a printing ID
  if (!card) {
    const parentId = await getPrintingParent(uniqueId);
    if (parentId) {
      card = await getCard(parentId);
      preSelectedPrintingId = uniqueId;
    }
  }

  // 3. If still not found, 404
  if (!card) notFound();

  // 4. Fetch related data using the CANONICAL card ID
  const [printings, prices] = await Promise.all([
    getCardPrintings(card.unique_id),
    getCardPrices(card.unique_id),
  ]);

  // Extract unique artists from all printings
  const artists = Array.from(
    new Set(printings.flatMap((p) => p.artists).filter(Boolean))
  );

  // Extract unique sets from printings for quick links
  const sets = Array.from(
    new Map(
      printings
        .filter((p) => p.set_name && p.set_id)
        .map((p) => [p.set_id, { code: p.set_id, name: p.set_name! }])
    ).values()
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 3-column layout: Image | Prices | Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] gap-8">
        {/* LEFT COLUMN — Card Image + Stats (sticky on desktop) */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <CardImage
            src={card.image_url}
            alt={card.name}
            width={300}
            height={420}
            className="w-full rounded-lg"
          />

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            <PitchDot pitch={card.pitch} />
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
        </div>

        {/* CENTER COLUMN — Printings + Prices + Chart */}
        <div className="min-w-0">
          {/* Mobile-only: Card name header */}
          <div className="lg:hidden mb-6">
            <h1 className="text-3xl font-bold mb-1">{card.name}</h1>
            <p className="text-gray-400">{card.type_text}</p>
          </div>

          {/* Printings */}
          {printings.length > 0 && (
            <section className="mb-8">
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
                      <tr
                        key={p.unique_id}
                        className={`border-b border-gray-800 hover:bg-gray-800/50 transition ${preSelectedPrintingId === p.unique_id ? "bg-gray-800/70" : ""}`}
                      >
                        <td className="py-2 px-2">
                          <Link
                            href={`/cards/${p.unique_id}`}
                            className="text-red-400 hover:text-red-300 font-mono"
                          >
                            {p.card_id}
                          </Link>
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
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">
              Price Comparison ({prices.length} listing
              {prices.length !== 1 ? "s" : ""})
            </h2>
            <PriceTable
              prices={prices}
              initialPrintingId={preSelectedPrintingId}
            />
          </section>

          {/* Price History Chart */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Price History</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <PriceChart cardUniqueId={card.unique_id} />
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN — Metadata (desktop only name here) */}
        <div>
          {/* Desktop: Card name + type */}
          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl font-bold mb-1">{card.name}</h1>
            <p className="text-gray-400 text-sm">{card.type_text}</p>
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
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Legality
            </h3>
            <div className="flex flex-wrap gap-2">
              <LegalBadge label="Blitz" legal={!!card.blitz_legal} />
              <LegalBadge label="CC" legal={!!card.cc_legal} />
              <LegalBadge label="Commoner" legal={!!card.commoner_legal} />
              <LegalBadge label="LL" legal={!!card.ll_legal} />
            </div>
          </div>

          {/* Keywords */}
          {card.card_keywords.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Keywords
              </h3>
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
            </div>
          )}

          {/* Sets */}
          {sets.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Sets
              </h3>
              <div className="flex flex-wrap gap-2">
                {sets.map((s) => (
                  <Link
                    key={s.code}
                    href={`/cards?set=${s.code}`}
                    className="bg-gray-800 text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded transition"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Artist Credits */}
          {artists.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                {artists.length === 1 ? "Artist" : "Artists"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {artists.map((artist) => (
                  <span
                    key={artist}
                    className="text-sm text-gray-300"
                  >
                    {artist}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
