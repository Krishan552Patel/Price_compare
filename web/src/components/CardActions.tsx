"use client";

import { useState } from "react";
import type { Printing } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────

const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
const CONDITION_LABELS: Record<string, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

// ── Types ─────────────────────────────────────────────────────────────────

interface Props {
  printings: Printing[];
  cardUniqueId: string;
  cardName: string;
  imageUrl: string | null;
  currentNMPrice: number | null;
}

type SubmitStatus = "idle" | "loading" | "success" | "error";

// ── Modal backdrop wrapper ────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Add to Collection Modal ───────────────────────────────────────────────

function CollectionModal({
  printings,
  onClose,
}: {
  printings: Printing[];
  onClose: () => void;
}) {
  const [printingId, setPrintingId] = useState(printings[0]?.unique_id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("NM");
  const [acquiredPrice, setAcquiredPrice] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function printingLabel(p: Printing) {
    // Card ID + set
    const parts = [p.card_id, p.set_name || p.set_id];
    // Edition (Alpha, Unlimited, etc.)
    if (p.edition) parts.push(p.edition);
    // Foiling — always shown so you can tell Standard / Cold / Rainbow / Gold apart
    const foiling = p.foiling_name ?? p.foiling ?? "Standard";
    parts.push(foiling);
    // Rarity for extra disambiguation (e.g. Fabled vs Legendary same set)
    if (p.rarity_name) parts.push(p.rarity_name);
    return parts.join(" · ");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!printingId) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/account/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printingUniqueId: printingId,
          quantity,
          condition,
          acquiredPrice: acquiredPrice ? parseFloat(acquiredPrice) : null,
          notes: null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add to collection");
      }
      setStatus("success");
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-5 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white">Add to Collection</h2>
        <p className="text-sm text-gray-400 mt-0.5">Track your physical cards</p>
      </div>

      <form onSubmit={submit} className="p-5 space-y-4">
        {/* Printing selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Printing</label>
          <select
            value={printingId}
            onChange={(e) => setPrintingId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            required
          >
            {printings.map((p) => (
              <option key={p.unique_id} value={p.unique_id}>
                {printingLabel(p)}
              </option>
            ))}
          </select>
          {/* Confirmation chip — shows the selected printing's key details */}
          {(() => {
            const sel = printings.find((p) => p.unique_id === printingId);
            if (!sel) return null;
            const foiling = sel.foiling_name ?? sel.foiling ?? "Standard";
            const isSpecialFoil = foiling !== "Standard" && foiling !== "Non-Foil";
            return (
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                <span className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-300">
                  {sel.card_id}
                </span>
                <span className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-300">
                  {sel.set_name || sel.set_id}
                  {sel.edition ? ` · ${sel.edition}` : ""}
                </span>
                <span
                  className={`border rounded px-2 py-0.5 font-medium ${
                    isSpecialFoil
                      ? "bg-yellow-900/30 border-yellow-600/50 text-yellow-300"
                      : "bg-gray-800 border-gray-700 text-gray-400"
                  }`}
                >
                  {foiling}
                </span>
                {sel.rarity_name && (
                  <span className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-400">
                    {sel.rarity_name}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Quantity + Condition */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c} — {CONDITION_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Acquired price */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Acquired Price (CA$){" "}
            <span className="text-gray-500 font-normal">optional</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="e.g. 12.50"
            value={acquiredPrice}
            onChange={(e) => setAcquiredPrice(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        {status === "error" && <p className="text-sm text-red-400">{errorMsg}</p>}
        {status === "success" && (
          <p className="text-sm text-green-400">✓ Added to collection!</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {status === "loading"
              ? "Adding…"
              : status === "success"
              ? "Added!"
              : "Add to Collection"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Set Price Alert Modal ─────────────────────────────────────────────────

function AlertModal({
  cardUniqueId,
  cardName,
  imageUrl,
  currentNMPrice,
  onClose,
}: {
  cardUniqueId: string;
  cardName: string;
  imageUrl: string | null;
  currentNMPrice: number | null;
  onClose: () => void;
}) {
  const [threshold, setThreshold] = useState("1.00");
  const [direction, setDirection] = useState("both");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum) || thresholdNum <= 0) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/account/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardUniqueId,
          cardName,
          imageUrl,
          thresholdCad: thresholdNum,
          direction,
          lastPriceSeen: currentNMPrice,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create alert");
      }
      setStatus("success");
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const thresholdNum = parseFloat(threshold || "0");
  const displayThreshold = isNaN(thresholdNum) ? "0.00" : thresholdNum.toFixed(2);

  return (
    <Modal onClose={onClose}>
      <div className="p-5 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white">Set Price Alert</h2>
        <p className="text-sm text-gray-400 mt-0.5 truncate">{cardName}</p>
        {currentNMPrice != null && (
          <p className="text-sm text-gray-500 mt-0.5">
            Current NM price:{" "}
            <span className="text-green-400 font-medium">
              CA${currentNMPrice.toFixed(2)}
            </span>
          </p>
        )}
      </div>

      <form onSubmit={submit} className="p-5 space-y-4">
        {/* Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Alert me when price changes by (CA$)
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            required
          />
        </div>

        {/* Direction toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Direction</label>
          <div className="flex gap-2">
            {[
              { value: "both", label: "Either way" },
              { value: "up", label: "↑ Goes up" },
              { value: "down", label: "↓ Drops" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDirection(opt.value)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition ${
                  direction === opt.value
                    ? "bg-red-600/20 border-red-500/60 text-red-300"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          You&apos;ll receive a daily email digest when this card&apos;s NM price
          moves by at least CA${displayThreshold}.
        </p>

        {status === "error" && <p className="text-sm text-red-400">{errorMsg}</p>}
        {status === "success" && (
          <p className="text-sm text-green-400">✓ Alert set! You&apos;ll be notified by email.</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {status === "loading"
              ? "Setting…"
              : status === "success"
              ? "Alert Set!"
              : "Set Alert"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

export default function CardActions({
  printings,
  cardUniqueId,
  cardName,
  imageUrl,
  currentNMPrice,
}: Props) {
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2 mt-2">
        {/* Add to Collection */}
        <button
          onClick={() => setCollectionOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition"
          title="Add to Collection"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m7-7v14" />
          </svg>
          <span>Collection</span>
        </button>

        {/* Set Price Alert */}
        <button
          onClick={() => setAlertOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white transition"
          title="Set Price Alert"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span>Set Alert</span>
        </button>
      </div>

      {collectionOpen && (
        <CollectionModal
          printings={printings}
          onClose={() => setCollectionOpen(false)}
        />
      )}
      {alertOpen && (
        <AlertModal
          cardUniqueId={cardUniqueId}
          cardName={cardName}
          imageUrl={imageUrl}
          currentNMPrice={currentNMPrice}
          onClose={() => setAlertOpen(false)}
        />
      )}
    </>
  );
}
