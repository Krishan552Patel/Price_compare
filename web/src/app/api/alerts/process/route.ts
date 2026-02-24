import { NextRequest, NextResponse } from "next/server";
import { getAllActiveAlertsWithUsers, bulkUpdateAlertPrices } from "@/lib/auth-queries";
import { getLowestNMPrices } from "@/lib/queries";
import { sendAlertDigest, type AlertDigestItem } from "@/lib/email";

const SITE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alerts = await getAllActiveAlertsWithUsers();
    if (alerts.length === 0) {
      return NextResponse.json({ processed: 0, triggered: 0 });
    }

    // Batch fetch current NM prices for all alerted cards
    const uniqueCardIds = [...new Set(alerts.map((a) => a.card_unique_id))];
    const prices = await getLowestNMPrices(uniqueCardIds);

    // Evaluate which alerts triggered
    type TriggeredAlert = AlertDigestItem & { alertId: string; userId: string; userEmail: string; userName: string | null; newPrice: number };
    const triggered: TriggeredAlert[] = [];
    const priceUpdates: { id: string; last_price_seen: number; last_notified_at?: boolean }[] = [];

    for (const alert of alerts) {
      const currentPrice = prices[alert.card_unique_id];
      if (currentPrice === undefined) continue;

      const oldPrice = alert.last_price_seen;
      priceUpdates.push({ id: alert.id, last_price_seen: currentPrice });

      if (oldPrice === null) continue; // First time seen — record price, don't alert yet

      const changeAbs = Math.abs(currentPrice - oldPrice);
      const priceDiff = currentPrice - oldPrice;
      const direction = priceDiff > 0 ? "up" : "down";

      if (changeAbs < alert.threshold_cad) continue;
      if (alert.direction !== "both" && alert.direction !== direction) continue;

      const changePct = (priceDiff / oldPrice) * 100;
      triggered.push({
        alertId: alert.id,
        userId: alert.user_id,
        userEmail: alert.user_email,
        userName: alert.user_name,
        cardName: alert.card_name,
        imageUrl: alert.image_url,
        oldPrice,
        newPrice: currentPrice,
        changeAbs,
        changePct,
        direction: direction as "up" | "down",
        cardUrl: `${SITE_URL}/cards/${alert.card_unique_id}`,
      });
      // Mark this alert as notified
      const u = priceUpdates.find((p) => p.id === alert.id);
      if (u) u.last_notified_at = true;
    }

    // Update last_price_seen (and last_notified_at where applicable)
    await bulkUpdateAlertPrices(priceUpdates);

    // Group triggered alerts by user and send one digest per user
    const byUser = new Map<string, TriggeredAlert[]>();
    for (const t of triggered) {
      if (!byUser.has(t.userId)) byUser.set(t.userId, []);
      byUser.get(t.userId)!.push(t);
    }

    let emailsSent = 0;
    for (const [, items] of byUser) {
      const { userEmail, userName } = items[0];
      await sendAlertDigest(
        userEmail,
        userName,
        items.map((i) => ({
          cardName: i.cardName,
          imageUrl: i.imageUrl,
          oldPrice: i.oldPrice,
          newPrice: i.newPrice,
          changeAbs: i.changeAbs,
          changePct: i.changePct,
          direction: i.direction,
          cardUrl: i.cardUrl,
        }))
      );
      emailsSent++;
    }

    return NextResponse.json({
      processed: alerts.length,
      triggered: triggered.length,
      emailsSent,
    });
  } catch (err) {
    console.error("[alerts/process]", err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
