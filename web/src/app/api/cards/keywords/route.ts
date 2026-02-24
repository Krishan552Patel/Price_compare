import { NextRequest, NextResponse } from "next/server";
import { getAvailableKeywords } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const selected = searchParams.get("selected");
    const subtypes = searchParams.get("subtypes");
    const talent = searchParams.get("talent") || undefined;
    const fusion = searchParams.get("fusion") || undefined;
    const specialization = searchParams.get("specialization") || undefined;
    const cardClass = searchParams.get("class") || undefined;
    const artVariation = searchParams.get("artVariation") || undefined;
    const set = searchParams.get("set") || undefined;
    const edition = searchParams.get("edition") || undefined;

    const selectedArray = selected
        ? selected.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const subtypesArray = subtypes
        ? subtypes.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const keywords = await getAvailableKeywords(selectedArray, {
        subtypes: subtypesArray.length > 0 ? subtypesArray : undefined,
        talent,
        fusion: fusion ? fusion.split(",").filter(Boolean) : undefined,
        specialization,
        class: cardClass,
        artVariation,
        set,
        edition,
    });

    return NextResponse.json(keywords, {
        headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
    });
}
