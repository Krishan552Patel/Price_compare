"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FilterOptions } from "@/lib/types";

// ── Filter keys ──
const FILTER_KEYS = [
    "set", "rarity", "foiling", "edition", "color",
    "class", "pitch", "keyword", "subtype", "talent", "fusion", "specialization", "artVariation", "inStockOnly",
    "power", "health", "cost", "defense",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const BASE_KEYS: FilterKey[] = ["inStockOnly", "pitch", "class", "foiling", "rarity"];
const ADVANCED_KEYS: FilterKey[] = ["set", "edition", "keyword", "subtype", "talent", "fusion", "specialization", "artVariation", "power", "health", "cost", "defense"];

function cx(...classes: (string | false | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}

const TALENT_VALUES = new Set([
    "Chaos", "Draconic", "Elemental",
    "Light", "Mystic", "Revered", "Reviled", "Royal", "Shadow",
]);

// Fusion elements — displayed in their own filter group
const FUSION_ELEMENTS = ["Earth", "Ice", "Lightning"];

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
export default function CardFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [options, setOptions] = useState<FilterOptions | null>(null);
    const [loading, setLoading] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    // Fetch filter options on mount
    useEffect(() => {
        setLoading(true);
        fetch("/api/cards/filters")
            .then((r) => r.json())
            .then((data) => setOptions(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // Count active filters
    const activeCount = useMemo(() => {
        let n = 0;
        for (const key of FILTER_KEYS) {
            if (searchParams.get(key)) n++;
        }
        return n;
    }, [searchParams]);

    const advancedCount = useMemo(() => {
        let n = 0;
        for (const key of ADVANCED_KEYS) {
            if (searchParams.get(key)) n++;
        }
        return n;
    }, [searchParams]);

    // ── URL helpers ──
    const setFilter = useCallback((key: FilterKey, value: string | null) => {
        const p = new URLSearchParams(searchParams.toString());
        if (!value) {
            p.delete(key);
        } else {
            p.set(key, value);
        }
        p.delete("page");
        router.push(`/cards?${p.toString()}`);
    }, [router, searchParams]);

    const clearAll = useCallback(() => {
        const p = new URLSearchParams(searchParams.toString());
        for (const key of FILTER_KEYS) p.delete(key);
        p.delete("page");
        router.push(`/cards?${p.toString()}`);
    }, [router, searchParams]);

    const clearAdvanced = useCallback(() => {
        const p = new URLSearchParams(searchParams.toString());
        for (const key of ADVANCED_KEYS) p.delete(key);
        p.delete("page");
        router.push(`/cards?${p.toString()}`);
    }, [router, searchParams]);

    const toggleFilter = useCallback((key: FilterKey, value: string) => {
        const current = searchParams.get(key);
        setFilter(key, current === value ? null : value);
    }, [searchParams, setFilter]);

    // Multi-select toggle: adds/removes values from comma-separated URL param
    const toggleMultiFilter = useCallback((key: FilterKey, value: string) => {
        const current = searchParams.get(key) || "";
        const values = current ? current.split(",").filter(Boolean) : [];
        const idx = values.indexOf(value);
        if (idx >= 0) {
            values.splice(idx, 1);
        } else {
            values.push(value);
        }
        setFilter(key, values.length > 0 ? values.join(",") : null);
    }, [searchParams, setFilter]);

    const current = useCallback((key: FilterKey) => searchParams.get(key) || "", [searchParams]);

    if (loading || !options) {
        return (
            <div className="w-full space-y-3">
                <div className="h-10 bg-gray-800/50 rounded-lg animate-pulse w-48" />
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            {/* ── In Stock Only toggle — always at top ── */}
            <div>
                <button
                    onClick={() => toggleFilter("inStockOnly", "1")}
                    className={cx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all duration-150",
                        current("inStockOnly") === "1"
                            ? "bg-green-600/20 border-green-500/60 text-green-400"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                    )}
                >
                    <span className={cx(
                        "w-3 h-3 rounded-full border-2 transition-colors",
                        current("inStockOnly") === "1"
                            ? "bg-green-500 border-green-400"
                            : "border-gray-600"
                    )} />
                    In Stock Only
                </button>
            </div>

            {/* ── Base Filters: always visible ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Pitch */}
                <PillGroup
                    label="Pitch"
                    items={[
                        { value: "0", label: "⚫ 0" },
                        ...options.pitches.filter(p => p !== "").map((p) => ({ value: p, label: pitchLabel(p) })),
                    ]}
                    filterKey="pitch"
                    current={current("pitch")}
                    onToggle={toggleFilter}
                />

                {/* Class */}
                <SearchableSelect
                    label="Class"
                    items={options.classes.map((c) => ({ value: c, label: c }))}
                    filterKey="class"
                    current={current("class")}
                    onSelect={setFilter}
                />

                {/* Foiling */}
                <PillGroup
                    label="Foiling"
                    items={options.foilings.map((f) => ({ value: f.unique_id, label: f.name }))}
                    filterKey="foiling"
                    current={current("foiling")}
                    onToggle={toggleFilter}
                />

                {/* Rarity */}
                <PillGroup
                    label="Rarity"
                    items={options.rarities.map((r) => ({ value: r.unique_id, label: r.name }))}
                    filterKey="rarity"
                    current={current("rarity")}
                    onToggle={toggleFilter}
                />
            </div>

            {/* ── Controls row: More Filters + active pills + Clear ── */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setAdvancedOpen(true)}
                    className={cx(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200",
                        advancedCount > 0
                            ? "bg-red-600/20 border-red-500/60 text-red-400"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 hover:border-gray-600"
                    )}
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                    More Filters
                    {advancedCount > 0 && (
                        <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {advancedCount}
                        </span>
                    )}
                </button>

                {/* Show active advanced filter pills inline */}
                {ADVANCED_KEYS.map((key) => {
                    const val = searchParams.get(key);
                    if (!val) return null;
                    // Multi-value keys show individual pills per value
                    if (key === "subtype" || key === "keyword") {
                        return val.split(",").filter(Boolean).map((v) => (
                            <span
                                key={`${key}-${v}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-800/80 border border-gray-700 text-gray-300"
                            >
                                {formatLabel(key)}: {v}
                                <button
                                    onClick={() => toggleMultiFilter(key, v)}
                                    className="ml-0.5 text-gray-500 hover:text-white transition-colors"
                                >
                                    ×
                                </button>
                            </span>
                        ));
                    }
                    const display = key === "inStockOnly" ? "In Stock" : `${formatLabel(key)}: ${getDisplayValue(key, val, options)}`;
                    return (
                        <span
                            key={key}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-800/80 border border-gray-700 text-gray-300"
                        >
                            {display}
                            <button
                                onClick={() => setFilter(key, null)}
                                className="ml-0.5 text-gray-500 hover:text-white transition-colors"
                            >
                                ×
                            </button>
                        </span>
                    );
                })}

                {activeCount > 0 && (
                    <button
                        onClick={clearAll}
                        className="text-xs text-red-400 hover:text-red-300 ml-auto transition-colors"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* ── Advanced Filters Modal ── */}
            {advancedOpen && (
                <AdvancedModal
                    options={options}
                    current={current}
                    toggleFilter={toggleFilter}
                    toggleMultiFilter={toggleMultiFilter}
                    setFilter={setFilter}
                    clearAdvanced={clearAdvanced}
                    advancedCount={advancedCount}
                    onClose={() => setAdvancedOpen(false)}
                />
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Advanced Filters Modal
// ────────────────────────────────────────────────────────────────
function AdvancedModal({
    options, current, toggleFilter, toggleMultiFilter, setFilter, clearAdvanced, advancedCount, onClose,
}: {
    options: FilterOptions;
    current: (key: FilterKey) => string;
    toggleFilter: (key: FilterKey, value: string) => void;
    toggleMultiFilter: (key: FilterKey, value: string) => void;
    setFilter: (key: FilterKey, value: string | null) => void;
    clearAdvanced: () => void;
    advancedCount: number;
    onClose: () => void;
}) {
    // Close on Escape
    useEffect(() => {
        function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white">Advanced Filters</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Set */}
                    <SearchableSelect
                        label="Set"
                        items={options.sets.map((s) => ({ value: s.set_code, label: s.name }))}
                        filterKey="set"
                        current={current("set")}
                        currentLabel={options.sets.find((s) => s.set_code === current("set"))?.name}
                        onSelect={setFilter}
                        availabilityUrl="/api/cards/sets"
                        crossFilters={{
                            keywords: current("keyword") || undefined,
                            subtypes: current("subtype") || undefined,
                            talent: current("talent") || undefined,
                            artVariation: current("artVariation") || undefined,
                            edition: current("edition") || undefined,
                        }}
                    />

                    {/* Edition */}
                    <PillGroup
                        label="Edition"
                        items={options.editions.map((e) => ({ value: e.unique_id, label: e.name }))}
                        filterKey="edition"
                        current={current("edition")}
                        onToggle={toggleFilter}
                        availabilityUrl="/api/cards/editions"
                        crossFilters={{
                            keywords: current("keyword") || undefined,
                            subtypes: current("subtype") || undefined,
                            talent: current("talent") || undefined,
                            artVariation: current("artVariation") || undefined,
                            set: current("set") || undefined,
                        }}
                    />

                    {/* Keyword — scrollable pill buttons with search */}
                    <SearchablePillGroup
                        label="Keyword"
                        items={options.keywords.map((k) => ({ value: k, label: k }))}
                        filterKey="keyword"
                        current={current("keyword")}
                        onToggle={toggleMultiFilter}
                        multiSelect
                        availabilityUrl="/api/cards/keywords"
                        crossFilters={{
                            subtypes: current("subtype") || undefined,
                            talent: current("talent") || undefined,
                            artVariation: current("artVariation") || undefined,
                            set: current("set") || undefined,
                            edition: current("edition") || undefined,
                        }}
                    />

                    {/* Subtype — scrollable pill buttons with search */}
                    <SearchablePillGroup
                        label="Subtype"
                        items={options.subtypes
                            .filter((s) => !TALENT_VALUES.has(s) && !FUSION_ELEMENTS.includes(s))
                            .map((s) => ({ value: s, label: s }))}
                        filterKey="subtype"
                        current={current("subtype")}
                        onToggle={toggleMultiFilter}
                        multiSelect
                        availabilityUrl="/api/cards/subtypes"
                        crossFilters={{
                            keywords: current("keyword") || undefined,
                            talent: current("talent") || undefined,
                            artVariation: current("artVariation") || undefined,
                            set: current("set") || undefined,
                            edition: current("edition") || undefined,
                        }}
                    />

                    {/* Fusion (Earth, Ice, Lightning) + Talent side by side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <PillGroup
                            label="Fusion"
                            items={FUSION_ELEMENTS.map((e) => ({ value: e, label: e }))}
                            filterKey="fusion"
                            current={current("fusion")}
                            onToggle={toggleFilter}
                        />
                        <PillGroup
                            label="Talent"
                            items={Array.from(TALENT_VALUES)
                                .sort()
                                .map((t) => ({ value: t, label: t }))}
                            filterKey="talent"
                            current={current("talent")}
                            onToggle={toggleFilter}
                            availabilityUrl="/api/cards/talents"
                            crossFilters={{
                                keywords: current("keyword") || undefined,
                                subtypes: current("subtype") || undefined,
                                artVariation: current("artVariation") || undefined,
                                set: current("set") || undefined,
                                edition: current("edition") || undefined,
                            }}
                        />
                    </div>

                    {/* Specialization + Art Variation side by side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SearchableSelect
                            label="Specialization"
                            items={(options.heroes || []).map((h) => ({ value: h, label: h }))}
                            filterKey="specialization"
                            current={current("specialization")}
                            currentLabel={current("specialization") || undefined}
                            onSelect={setFilter}
                            placeholder="None"
                        />
                        <PillGroup
                            label="Art Variation"
                            items={[
                                { value: "AB", label: "Alt Border" },
                                { value: "AA", label: "Alt Art" },
                                { value: "AT", label: "Alt Text" },
                                { value: "EA", label: "Extended Art" },
                                { value: "FA", label: "Full Art" },
                                { value: "HS", label: "Half Size" },
                            ]}
                            filterKey="artVariation"
                            current={current("artVariation")}
                            onToggle={toggleFilter}
                            availabilityUrl="/api/cards/art-variations"
                            crossFilters={{
                                keywords: current("keyword") || undefined,
                                subtypes: current("subtype") || undefined,
                                talent: current("talent") || undefined,
                                set: current("set") || undefined,
                                edition: current("edition") || undefined,
                            }}
                        />
                    </div>

                    {/* Stat Filters: Cost, Power, Defense, Health */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatInput label="Cost" filterKey="cost" current={current("cost")} onSet={setFilter} />
                        <StatInput label="Power" filterKey="power" current={current("power")} onSet={setFilter} />
                        <StatInput label="Defense" filterKey="defense" current={current("defense")} onSet={setFilter} />
                        <StatInput label="Health" filterKey="health" current={current("health")} onSet={setFilter} />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/80">
                    {advancedCount > 0 ? (
                        <button onClick={clearAdvanced} className="text-sm text-red-400 hover:text-red-300 transition-colors">
                            Clear advanced filters
                        </button>
                    ) : (
                        <span className="text-xs text-gray-600">No advanced filters active</span>
                    )}
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div >
        </div >
    );
}

// ────────────────────────────────────────────────────────────────
// PillGroup — for small lists, with optional dynamic availability
// ────────────────────────────────────────────────────────────────
function PillGroup({
    label, items, filterKey, current, onToggle, availabilityUrl, crossFilters,
}: {
    label: string;
    items: { value: string; label: string }[];
    filterKey: FilterKey;
    current: string;
    onToggle: (key: FilterKey, value: string) => void;
    availabilityUrl?: string;
    crossFilters?: Record<string, string | undefined>;
}) {
    const [availableValues, setAvailableValues] = useState<Set<string> | null>(null);

    // Stable serialisation of crossFilters for useEffect dependency
    const crossFilterKey = crossFilters
        ? Object.entries(crossFilters)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}=${v}`)
            .join("&")
        : "";

    useEffect(() => {
        if (!availabilityUrl) { setAvailableValues(null); return; }
        // Only fetch when there's at least one active cross-filter
        if (!crossFilterKey) { setAvailableValues(null); return; }

        const controller = new AbortController();
        fetch(`${availabilityUrl}?${crossFilterKey}`, { signal: controller.signal })
            .then((r) => r.json())
            .then((data: string[]) => setAvailableValues(new Set(data)))
            .catch(() => { });
        return () => controller.abort();
    }, [availabilityUrl, crossFilterKey]);

    return (
        <div>
            <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                {label}
            </span>
            <div className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                    const isSelected = current === item.value;
                    const isUnavailable = availableValues !== null && !isSelected && !availableValues.has(item.value);
                    return (
                        <button
                            key={item.value}
                            onClick={() => !isUnavailable && onToggle(filterKey, item.value)}
                            className={cx(
                                "px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150",
                                isSelected
                                    ? "bg-red-600/25 border-red-500/60 text-red-300 shadow-sm shadow-red-500/10"
                                    : isUnavailable
                                        ? "bg-gray-800/40 border-gray-800 text-gray-600 cursor-not-allowed"
                                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                            )}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// SearchablePillGroup — pills with a search filter for large lists
// ────────────────────────────────────────────────────────────────
function SearchablePillGroup({
    label, items, filterKey, current, onToggle, multiSelect, availabilityUrl,
    crossFilters,
}: {
    label: string;
    items: { value: string; label: string }[];
    filterKey: FilterKey;
    current: string;
    onToggle: (key: FilterKey, value: string) => void;
    multiSelect?: boolean;
    availabilityUrl?: string;
    crossFilters?: Record<string, string | undefined>;
}) {
    const [search, setSearch] = useState("");
    const [availableValues, setAvailableValues] = useState<Set<string> | null>(null);

    const selectedSet = useMemo(() => {
        if (!current) return new Set<string>();
        return new Set(multiSelect ? current.split(",").filter(Boolean) : [current]);
    }, [current, multiSelect]);

    // Stable serialisation of crossFilters for useEffect dependency
    const crossFilterKey = crossFilters
        ? Object.entries(crossFilters)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}=${v}`)
            .join("&")
        : "";

    // Fetch available values when selection or cross-filter changes
    useEffect(() => {
        if (!multiSelect || !availabilityUrl) { setAvailableValues(null); return; }
        const selectedArr = Array.from(selectedSet);
        if (selectedArr.length === 0 && !crossFilterKey) { setAvailableValues(null); return; }

        const params = new URLSearchParams();
        if (selectedArr.length > 0) params.set("selected", selectedArr.join(","));
        // Append all cross-filter params
        if (crossFilters) {
            for (const [k, v] of Object.entries(crossFilters)) {
                if (v) params.set(k, v);
            }
        }

        const controller = new AbortController();
        fetch(`${availabilityUrl}?${params.toString()}`, {
            signal: controller.signal,
        })
            .then((r) => r.json())
            .then((data: string[]) => setAvailableValues(new Set(data)))
            .catch(() => { });
        return () => controller.abort();
    }, [selectedSet, multiSelect, availabilityUrl, crossFilterKey, crossFilters]);

    const filtered = useMemo(() => {
        let list = items;
        if (!search) {
            // When we have availability data, show selected first, then available, then unavailable
            if (availableValues) {
                list = [
                    ...items.filter((i) => selectedSet.has(i.value)),
                    ...items.filter((i) => !selectedSet.has(i.value) && availableValues.has(i.value)),
                    ...items.filter((i) => !selectedSet.has(i.value) && !availableValues.has(i.value)),
                ];
            }
            return list;
        }
        const q = search.toLowerCase();
        return items.filter((i) => i.label.toLowerCase().includes(q));
    }, [items, search, availableValues, selectedSet]);

    return (
        <div>
            <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                {label}
                {selectedSet.size > 0 && (
                    <span className="ml-2 text-red-400 text-[10px] font-bold">
                        {selectedSet.size} selected
                    </span>
                )}
            </span>
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}s…`}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none mb-2"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-800 p-2">
                <div className="flex flex-wrap gap-1.5">
                    {filtered.map((item) => {
                        const isSelected = selectedSet.has(item.value);
                        const isAvailable = !availableValues || availableValues.has(item.value) || isSelected;
                        return (
                            <button
                                key={item.value}
                                onClick={() => isAvailable ? onToggle(filterKey, item.value) : undefined}
                                disabled={!isAvailable}
                                className={cx(
                                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150",
                                    isSelected
                                        ? "bg-red-600/25 border-red-500/60 text-red-300 shadow-sm shadow-red-500/10"
                                        : isAvailable
                                            ? "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                                            : "bg-gray-900/50 border-gray-800/50 text-gray-700 cursor-not-allowed opacity-40"
                                )}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                    {filtered.length === 0 && (
                        <span className="text-sm text-gray-600 px-2 py-1">No matches</span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// SearchableSelect — for large lists
// ────────────────────────────────────────────────────────────────
function SearchableSelect({
    label, items, filterKey, current, currentLabel, onSelect, availabilityUrl, crossFilters, placeholder,
}: {
    label: string;
    items: { value: string; label: string }[];
    filterKey: FilterKey;
    current: string;
    currentLabel?: string;
    onSelect: (key: FilterKey, value: string | null) => void;
    availabilityUrl?: string;
    crossFilters?: Record<string, string | undefined>;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [availableValues, setAvailableValues] = useState<Set<string> | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    // Stable serialisation of crossFilters for useEffect dependency
    const crossFilterKey = crossFilters
        ? Object.entries(crossFilters)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}=${v}`)
            .join("&")
        : "";

    useEffect(() => {
        if (!availabilityUrl) { setAvailableValues(null); return; }
        if (!crossFilterKey) { setAvailableValues(null); return; }
        const controller = new AbortController();
        fetch(`${availabilityUrl}?${crossFilterKey}`, { signal: controller.signal })
            .then((r) => r.json())
            .then((data: string[]) => setAvailableValues(new Set(data)))
            .catch(() => { });
        return () => controller.abort();
    }, [availabilityUrl, crossFilterKey]);

    useEffect(() => {
        if (!open) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const filtered = useMemo(() => {
        let list = items;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter((i) => i.label.toLowerCase().includes(q));
        }
        return list.slice(0, 50);
    }, [items, search]);

    const displayLabel = current
        ? currentLabel || items.find((i) => i.value === current)?.label || current
        : "";

    return (
        <div ref={ref} className="relative">
            <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                {label}
            </span>
            <button
                onClick={() => { setOpen(!open); setSearch(""); }}
                className={cx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all duration-150 text-left",
                    current
                        ? "bg-red-600/15 border-red-500/50 text-red-300"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                )}
            >
                <span className="truncate">{displayLabel || placeholder || `All ${label}s`}</span>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                    {current && (
                        <span
                            onClick={(e) => { e.stopPropagation(); onSelect(filterKey, null); }}
                            className="text-gray-500 hover:text-white text-xs transition-colors cursor-pointer"
                        >
                            ×
                        </span>
                    )}
                    <svg className={cx("w-4 h-4 transition-transform text-gray-500", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {open && (
                <div className="absolute z-[60] mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2">
                        <input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={`Search ${label.toLowerCase()}s…`}
                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        <button
                            onClick={() => { onSelect(filterKey, null); setOpen(false); }}
                            className={cx(
                                "w-full text-left px-3 py-1.5 text-sm transition-colors",
                                !current ? "text-red-400 bg-red-600/10" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            )}
                        >
                            {placeholder || `All ${label}s`}
                        </button>
                        {filtered.map((item) => {
                            const isUnavailable = availableValues !== null && current !== item.value && !availableValues.has(item.value);
                            return (
                                <button
                                    key={item.value}
                                    onClick={() => {
                                        if (!isUnavailable) { onSelect(filterKey, item.value); setOpen(false); }
                                    }}
                                    className={cx(
                                        "w-full text-left px-3 py-1.5 text-sm transition-colors",
                                        current === item.value
                                            ? "text-red-400 bg-red-600/10"
                                            : isUnavailable
                                                ? "text-gray-700 cursor-not-allowed"
                                                : "text-gray-300 hover:bg-gray-800 hover:text-white"
                                    )}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="px-3 py-3 text-sm text-gray-600 text-center">No matches</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// StatInput — a simple numeric input for stat filters
// ────────────────────────────────────────────────────────────────
function StatInput({
    label, filterKey, current, onSet,
}: {
    label: string;
    filterKey: FilterKey;
    current: string;
    onSet: (key: FilterKey, value: string | null) => void;
}) {
    const [value, setValue] = useState(current);

    // Sync with URL changes
    useEffect(() => { setValue(current); }, [current]);

    return (
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            <input
                type="number"
                min="0"
                placeholder="Any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => onSet(filterKey, value || null)}
                onKeyDown={(e) => { if (e.key === "Enter") onSet(filterKey, value || null); }}
                className="w-full px-3 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500/60 transition-colors"
            />
        </div>
    );
}

// ── Helpers ──
function formatLabel(key: string): string {
    const map: Record<string, string> = {
        set: "Set", rarity: "Rarity", foiling: "Foiling", edition: "Edition",
        color: "Color", class: "Class", pitch: "Pitch", keyword: "Keyword",
        subtype: "Subtype", talent: "Talent", fusion: "Fusion",
        specialization: "Specialization", inStockOnly: "In Stock",
        power: "Power", health: "Health", cost: "Cost", defense: "Defense",
    };
    return map[key] || key;
}

function pitchLabel(p: string): string {
    const colors: Record<string, string> = { "1": "🔴 1", "2": "🟡 2", "3": "🔵 3" };
    return colors[p] || p;
}

function getDisplayValue(key: FilterKey, value: string, options: FilterOptions): string {
    if (key === "set") return options.sets.find((s) => s.set_code === value)?.name || value;
    if (key === "edition") return options.editions.find((e) => e.unique_id === value)?.name || value;
    return value;
}
