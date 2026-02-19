import { NextRequest, NextResponse } from "next/server";
import { getAvailableTalents } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const p = request.nextUrl.searchParams;
    const keywords = p.get("keywords") || undefined;
    const subtypes = p.get("subtypes") || undefined;
    const artVariation = p.get("artVariation") || undefined;

    const crossFilters: { keywords?: string[]; subtypes?: string[]; artVariation?: string } = {};
    if (keywords) crossFilters.keywords = keywords.split(",");
    if (subtypes) crossFilters.subtypes = subtypes.split(",");
    if (artVariation) crossFilters.artVariation = artVariation;

    const available = await getAvailableTalents(
        Object.keys(crossFilters).length > 0 ? crossFilters : undefined
    );

    return NextResponse.json(available, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
}
