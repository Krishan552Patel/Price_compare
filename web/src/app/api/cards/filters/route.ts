import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/queries";

export async function GET() {
    try {
        const filters = await getFilterOptions();

        return NextResponse.json(filters, {
            headers: {
                "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
                "CDN-Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
                "Vercel-CDN-Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("Filter options error:", error);
        return NextResponse.json(
            { error: "Failed to fetch filter options" },
            { status: 500 }
        );
    }
}
