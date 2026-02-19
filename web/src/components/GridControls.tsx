"use client";

import { useRouter, useSearchParams } from "next/navigation";

const densityOptions = [
  { value: "few", label: "Few" },
  { value: "regular", label: "Regular" },
  { value: "many", label: "Many" },
  { value: "most", label: "Most" },
] as const;

export default function GridControls({
  currentDensity,
  currentView,
}: {
  currentDensity: string;
  currentView: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/cards?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      {/* View toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700">
        <button
          onClick={() => setParam("view", "grid", "grid")}
          title="Grid view"
          className={`px-2.5 py-1.5 transition ${
            currentView === "grid"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          onClick={() => setParam("view", "table", "grid")}
          title="Table view"
          className={`px-2.5 py-1.5 transition ${
            currentView === "table"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Density (only relevant for grid view) */}
      {currentView === "grid" && (
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {densityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setParam("density", opt.value, "regular")}
              className={`px-3 py-1.5 text-xs transition ${
                currentDensity === opt.value
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
