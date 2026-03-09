import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { addToCollection } from "@/lib/auth-queries";

const VALID_CONDITIONS = new Set(["NM", "LP", "MP", "HP", "DMG"]);
const MAX_ROWS = 500;

interface ImportRow {
  printingUniqueId: string;
  quantity?: number;
  condition?: string;
  acquiredPrice?: number | null;
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { rows }: { rows: ImportRow[] } = await req.json();

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Max ${MAX_ROWS} rows per import` }, { status: 400 });
    }

    let imported = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.printingUniqueId) {
        errors.push({ row: i + 1, reason: "Missing printingUniqueId" });
        continue;
      }

      const condition =
        row.condition && VALID_CONDITIONS.has(row.condition) ? row.condition : "NM";
      const quantity = Math.max(1, Number(row.quantity) || 1);

      try {
        await addToCollection({
          userId: session.user.id,
          printingUniqueId: row.printingUniqueId,
          quantity,
          condition,
          acquiredPrice: row.acquiredPrice ? Number(row.acquiredPrice) : null,
          notes: row.notes ?? null,
        });
        imported++;
      } catch {
        errors.push({ row: i + 1, reason: "Card printing not found in database" });
      }
    }

    return NextResponse.json({ imported, errors });
  } catch (err) {
    console.error("[collection import POST]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
