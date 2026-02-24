import { NextRequest, NextResponse } from "next/server";
import { getAvailableSets } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const keywords = searchParams.get("keywords") || undefined;
    const subtypes = searchParams.get("subtypes") || undefined;
    const talent = searchParams.get("talent") || undefined;
    const fusion = searchParams.get("fusion") || undefined;
    const specialization = searchParams.get("specialization") || undefined;
    const cardClass = searchParams.get("class") || undefined;
    const artVariation = searchParams.get("artVariation") || undefined;
    const edition = searchParams.get("edition") || undefined;

    const keywordsArray = keywords ? keywords.split(",").filter(Boolean) : undefined;
    const subtypesArray = subtypes ? subtypes.split(",").filter(Boolean) : undefined;

    const sets = await getAvailableSets({
        keywords: keywordsArray,
        subtypes: subtypesArray,
        talent,
        fusion: fusion ? fusion.split(",").filter(Boolean) : undefined,
        specialization,
        class: cardClass,
        artVariation,
        edition,
    });

    return NextResponse.json(sets, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
}
