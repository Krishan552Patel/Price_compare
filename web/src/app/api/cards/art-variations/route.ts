import { NextRequest, NextResponse } from "next/server";
import { getAvailableArtVariations } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const p = request.nextUrl.searchParams;
    const keywords = p.get("keywords") || undefined;
    const subtypes = p.get("subtypes") || undefined;
    const talent = p.get("talent") || undefined;
    const set = p.get("set") || undefined;
    const edition = p.get("edition") || undefined;

    const crossFilters: { keywords?: string[]; subtypes?: string[]; talent?: string; set?: string; edition?: string } = {};
    if (keywords) crossFilters.keywords = keywords.split(",");
    if (subtypes) crossFilters.subtypes = subtypes.split(",");
    if (talent) crossFilters.talent = talent;
    if (set) crossFilters.set = set;
    if (edition) crossFilters.edition = edition;

    const available = await getAvailableArtVariations(
        Object.keys(crossFilters).length > 0 ? crossFilters : undefined
    );

    return NextResponse.json(available, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
}
