import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRecurringCharge, PLANS, PlanKey } from "@/lib/billing";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  const planParam = req.nextUrl.searchParams.get("plan") as PlanKey | null;

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }
  if (!planParam || planParam === "free" || !(planParam in PLANS)) {
    return NextResponse.json(
      { error: "Missing or invalid plan. Use ?plan=growth or ?plan=pro" },
      { status: 400 }
    );
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const charge = await createRecurringCharge(shop, shopRecord.accessToken, planParam);

  // Redirect the merchant to Shopify's own hosted approval page.
  // They'll see the price, trial period, and an Accept/Decline button.
  return NextResponse.redirect(charge.confirmation_url);
}
