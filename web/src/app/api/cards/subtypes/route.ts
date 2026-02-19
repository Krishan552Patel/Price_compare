import { NextRequest, NextResponse } from "next/server";
import { getAvailableSubtypes } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const selected = searchParams.get("selected");
    const keywords = searchParams.get("keywords");
    const talent = searchParams.get("talent") || undefined;
    const artVariation = searchParams.get("artVariation") || undefined;
    const set = searchParams.get("set") || undefined;
    const edition = searchParams.get("edition") || undefined;

    const selectedArray = selected
        ? selected.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const keywordsArray = keywords
        ? keywords.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const subtypes = await getAvailableSubtypes(selectedArray, {
        keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
        talent,
        artVariation,
        set,
        edition,
    });

    return NextResponse.json(subtypes, {
        headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
    });
}
