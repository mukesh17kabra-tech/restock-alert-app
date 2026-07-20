import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";

// Triggered daily by Vercel Cron (see vercel.json). Protected by a shared
// secret so only Vercel's scheduler (or you, manually) can call it.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Only Growth/Pro shops get the reminder perk.
  const eligibleShops = await db.shop.findMany({
    where: { plan: { in: ["growth", "pro"] } },
    select: { id: true, shopDomain: true },
  });

  let sent = 0;

  for (const shop of eligibleShops) {
    const dueForReminder = await db.variantSubscriber.findMany({
      where: {
        shopId: shop.id,
        notified: true,
        reminderSent: false,
        notifiedAt: { lte: cutoff },
      },
    });

    for (const sub of dueForReminder) {
      if (!sub.email) continue; // WhatsApp-only signups don't get this email reminder

      try {
        await sendReminderEmail({
          to: sub.email,
          productTitle: sub.productTitle,
          variantTitle: sub.variantTitle,
          productUrl: `https://${shop.shopDomain}/products/${sub.productId}`,
        });
        await db.variantSubscriber.update({
          where: { id: sub.id },
          data: { reminderSent: true },
        });
        sent++;
      } catch (err) {
        console.error(`Reminder failed for ${sub.email}:`, err);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
