import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAlerts, createAlert } from "@/lib/auth-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const alerts = await getAlerts(session.user.id);
  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { cardUniqueId, cardName, imageUrl = null, thresholdCad = 1, direction = "both", lastPriceSeen = null } = await req.json();
    if (!cardUniqueId || !cardName) return NextResponse.json({ error: "cardUniqueId and cardName required" }, { status: 400 });
    const alert = await createAlert({
      userId: session.user.id,
      cardUniqueId,
      cardName,
      imageUrl,
      thresholdCad: Number(thresholdCad),
      direction,
      lastPriceSeen: lastPriceSeen ? Number(lastPriceSeen) : null,
    });
    return NextResponse.json(alert, { status: 201 });
  } catch (err) {
    console.error("[alerts POST]", err);
    return NextResponse.json({ error: "Failed to create alert." }, { status: 500 });
  }
}
