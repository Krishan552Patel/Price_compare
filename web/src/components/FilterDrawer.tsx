"use client";

import { useState, useEffect } from "react";
import FilterSidebar from "./FilterSidebar";
import type { FilterOptions } from "@/lib/types";

export default function FilterDrawer({
  filters,
  filterCount,
  currentSet,
  currentRarity,
  currentColor,
  currentType,
  currentQuery,
  currentInStock,
  currentShowPrintings,
  currentMinPrice,
  currentMaxPrice,
}: {
  filters: FilterOptions;
  filterCount: number;
  currentSet?: string;
  currentRarity?: string;
  currentColor?: string;
  currentType?: string;
  currentQuery?: string;
  currentInStock?: boolean;
  currentShowPrintings?: boolean;
  currentMinPrice?: number;
  currentMaxPrice?: number;
}) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-white px-4 py-2 rounded-lg transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filters
        {filterCount > 0 && (
          <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {filterCount}
          </span>
        )}
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Drawer from right */}
          <div
            className="absolute top-0 right-0 h-full w-80 max-w-full bg-gray-900 border-l border-gray-800 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">Filters</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter content */}
            <div className="p-4">
              <FilterSidebar
                filters={filters}
                currentSet={currentSet}
                currentRarity={currentRarity}
                currentColor={currentColor}
                currentType={currentType}
                currentQuery={currentQuery}
                currentInStock={currentInStock}
                currentShowPrintings={currentShowPrintings}
                currentMinPrice={currentMinPrice}
                currentMaxPrice={currentMaxPrice}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
