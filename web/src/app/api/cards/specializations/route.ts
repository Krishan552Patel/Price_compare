import { NextRequest, NextResponse } from "next/server";
import { getAvailableSpecializations } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const p = request.nextUrl.searchParams;
    const keywords = p.get("keywords") || undefined;
    const subtypes = p.get("subtypes") || undefined;
    const talent = p.get("talent") || undefined;
    const fusion = p.get("fusion") || undefined;
    const cardClass = p.get("class") || undefined;
    const artVariation = p.get("artVariation") || undefined;
    const set = p.get("set") || undefined;
    const edition = p.get("edition") || undefined;

    const crossFilters: Record<string, unknown> = {};
    if (keywords) crossFilters.keywords = keywords.split(",").filter(Boolean);
    if (subtypes) crossFilters.subtypes = subtypes.split(",").filter(Boolean);
    if (talent) crossFilters.talent = talent;
    if (fusion) crossFilters.fusion = fusion.split(",").filter(Boolean);
    if (cardClass) crossFilters.class = cardClass;
    if (artVariation) crossFilters.artVariation = artVariation;
    if (set) crossFilters.set = set;
    if (edition) crossFilters.edition = edition;

    const available = await getAvailableSpecializations(
        Object.keys(crossFilters).length > 0 ? crossFilters as Parameters<typeof getAvailableSpecializations>[0] : undefined
    );

    return NextResponse.json(available, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
}
