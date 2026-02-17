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
}: {
  currentDensity: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setDensity(density: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (density === "regular") {
      params.delete("density");
    } else {
      params.set("density", density);
    }
    router.push(`/cards?${params.toString()}`);
  }

  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-700">
      {densityOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setDensity(opt.value)}
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
  );
}
