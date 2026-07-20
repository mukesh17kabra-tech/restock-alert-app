import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/billing";
import { createUsageCharge } from "@/lib/billing";

// Triggered monthly by Vercel Cron (see vercel.json). For each shop whose
// billing cycle has run its course (~30 days since it last reset):
//   1. If they're on Business tier and went over the included 3,000
//      WhatsApp messages, bill the overage via Shopify's Usage Charge API
//      ($5 per extra 1,000 messages, rounded up).
//   2. Reset whatsappMessagesThisCycle to 0 and bump currentCycleStartedAt
//      for every shop, regardless of plan, so next month starts fresh.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cycleLength = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - cycleLength);

  const dueShops = await db.shop.findMany({
    where: { currentCycleStartedAt: { lte: cutoff } },
  });

  let billed = 0;
  let reset = 0;

  for (const shop of dueShops) {
    const plan = PLANS[shop.plan as keyof typeof PLANS] ?? PLANS.free;

    if (
      shop.plan === "business" &&
      shop.recurringChargeId &&
      shop.whatsappMessagesThisCycle > plan.whatsappMessageCap
    ) {
      const overage = shop.whatsappMessagesThisCycle - plan.whatsappMessageCap;
      const blocksOf1000 = Math.ceil(overage / 1000);
      const amount = blocksOf1000 * PLANS.business.overagePricePerThousand;

      try {
        await createUsageCharge(
          shop.shopDomain,
          shop.accessToken,
          shop.recurringChargeId,
          amount,
          `WhatsApp overage: ${overage} messages beyond included ${plan.whatsappMessageCap}`
        );
        billed++;
      } catch (err) {
        console.error(`[billing-cycle] Failed to bill overage for ${shop.shopDomain}:`, err);
      }
    }

    await db.shop.update({
      where: { id: shop.id },
      data: { whatsappMessagesThisCycle: 0, currentCycleStartedAt: new Date() },
    });
    reset++;
  }

  return NextResponse.json({ ok: true, billed, reset });
}
