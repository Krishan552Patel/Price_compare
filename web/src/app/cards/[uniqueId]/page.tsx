import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCard,
  getCardPrintings,
  getCardPrices,
  getPrintingParent,
} from "@/lib/queries";
import { auth } from "@/auth";
import CardImage from "@/components/CardImage";
import { ColorBadge, LegalBadge, PitchDot, FoilingBadge, RarityBadge } from "@/components/Badge";
import PriceTable from "@/components/PriceTable";
import PriceChart from "@/components/PriceChart";
import WatchlistButton from "@/components/WatchlistButton";
import CardActions from "@/components/CardActions";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ uniqueId: string }>;
}) {
  const { uniqueId } = await params;

  // 1. Try to find the card directly
  let card = await getCard(uniqueId);
  let preSelectedPrintingId: string | undefined;
  // Tracks the printing the URL actually points to — used for the display image.
  // preSelectedPrintingId may be overridden to an in-stock printing for the price
  // table, but we always want to show the image the user explicitly navigated to.
  let urlPrintingId: string | undefined;

  // 2. If not found, check if it's a printing ID
  if (!card) {
    const parentId = await getPrintingParent(uniqueId);
    if (parentId) {
      card = await getCard(parentId);
      preSelectedPrintingId = uniqueId;
      urlPrintingId = uniqueId;
    }
  }

  // 3. If still not found, 404
  if (!card) notFound();

  // 4. Fetch related data + session in parallel
  const [printings, prices, session] = await Promise.all([
    getCardPrintings(card.unique_id),
    getCardPrices(card.unique_id, false), // false = include out of stock
    auth(),
  ]);

  const isLoggedIn = !!session?.user?.id;

  // If a specific printing was requested but has no in-stock prices,
  // override preSelectedPrintingId for the price table (but keep urlPrintingId
  // pointing at the original so the image stays correct).
  const inStockPrices = prices.filter((p) => p.in_stock);
  if (preSelectedPrintingId) {
    const hasInStockForSelected = inStockPrices.some(
      (p) => p.printing_unique_id === preSelectedPrintingId
    );
    if (!hasInStockForSelected && inStockPrices.length > 0) {
      // Redirect price table to first in-stock printing, but image stays on URL printing
      preSelectedPrintingId = inStockPrices[0].printing_unique_id;
    }
  }

  // Resolve the image: prefer the URL-requested printing's image, fall back to card default
  const urlPrinting = urlPrintingId
    ? printings.find((p) => p.unique_id === urlPrintingId)
    : null;
  const displayImageUrl = urlPrinting?.image_url || card.image_url;

  // Lowest NM in-stock price (for watchlist snapshot + alert)
  const lowestNMPrice = prices
    .filter((p) => p.in_stock && p.condition === "NM")
    .reduce<number | null>((min, p) => (min === null || p.price_cad < min ? p.price_cad : min), null);

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
            src={displayImageUrl}
            alt={card.name}
            width={300}
            height={420}
            className="w-full rounded-lg"
          />

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            <PitchDot pitch={card.pitch} />
            <ColorBadge color={card.color} />
            {card.pitch !== null && card.pitch !== "" && (
              <StatPill label="Pitch" value={card.pitch} />
            )}
            {card.cost !== null && card.cost !== "" && (
              <StatPill label="Cost" value={card.cost} />
            )}
            {card.power !== null && card.power !== "" && (
              <StatPill label="Power" value={card.power} />
            )}
            {card.defense !== null && card.defense !== "" && (
              <StatPill label="Defense" value={card.defense} />
            )}
            {card.health !== null && card.health !== "" && (
              <StatPill label="Health" value={card.health} />
            )}
            {card.intelligence !== null && card.intelligence !== "" && (
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

        {/* RIGHT COLUMN — Metadata */}
        <div>
          {/* Desktop: Card name + type + action buttons */}
          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl font-bold mb-1">{card.name}</h1>
            <p className="text-gray-400 text-sm">{card.type_text}</p>
            <div className="mt-3">
              <WatchlistButton
                cardUniqueId={card.unique_id}
                cardName={card.name}
                imageUrl={displayImageUrl}
                priceAtAdd={lowestNMPrice}
                variant="pill"
              />
            </div>
            {/* Collection + Alert actions — logged-in users only */}
            {isLoggedIn ? (
              <CardActions
                printings={printings}
                cardUniqueId={card.unique_id}
                cardName={card.name}
                imageUrl={displayImageUrl}
                currentNMPrice={lowestNMPrice}
              />
            ) : (
              <div className="mt-2">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm font-medium bg-gray-800/60 border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition"
                >
                  Login to track collection &amp; alerts
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: Watchlist + action buttons */}
          <div className="lg:hidden mb-4 space-y-2">
            <WatchlistButton
              cardUniqueId={card.unique_id}
              cardName={card.name}
              imageUrl={displayImageUrl}
              priceAtAdd={lowestNMPrice}
              variant="pill"
            />
            {isLoggedIn ? (
              <CardActions
                printings={printings}
                cardUniqueId={card.unique_id}
                cardName={card.name}
                imageUrl={displayImageUrl}
                currentNMPrice={lowestNMPrice}
              />
            ) : (
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm font-medium bg-gray-800/60 border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition"
              >
                Login to track collection &amp; alerts
              </Link>
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
                  <span key={artist} className="text-sm text-gray-300">
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
