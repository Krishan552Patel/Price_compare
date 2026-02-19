import { NextRequest, NextResponse } from "next/server";
import { getAvailableArtVariations } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const p = request.nextUrl.searchParams;
    const keywords = p.get("keywords") || undefined;
    const subtypes = p.get("subtypes") || undefined;
    const talent = p.get("talent") || undefined;

    const crossFilters: { keywords?: string[]; subtypes?: string[]; talent?: string } = {};
    if (keywords) crossFilters.keywords = keywords.split(",");
    if (subtypes) crossFilters.subtypes = subtypes.split(",");
    if (talent) crossFilters.talent = talent;

    const available = await getAvailableArtVariations(
        Object.keys(crossFilters).length > 0 ? crossFilters : undefined
    );

    return NextResponse.json(available, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
}
