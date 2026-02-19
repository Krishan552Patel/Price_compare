import { NextRequest, NextResponse } from "next/server";
import { getAvailableEditions } from "@/lib/queries";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const keywords = searchParams.get("keywords") || undefined;
    const subtypes = searchParams.get("subtypes") || undefined;
    const talent = searchParams.get("talent") || undefined;
    const artVariation = searchParams.get("artVariation") || undefined;
    const set = searchParams.get("set") || undefined;

    const keywordsArray = keywords ? keywords.split(",").filter(Boolean) : undefined;
    const subtypesArray = subtypes ? subtypes.split(",").filter(Boolean) : undefined;

    const editions = await getAvailableEditions({
        keywords: keywordsArray,
        subtypes: subtypesArray,
        talent,
        artVariation,
        set,
    });

    return NextResponse.json(editions, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
}
