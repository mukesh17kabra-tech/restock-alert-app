import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { PLANS, PlanKey } from "@/lib/billing";

const schema = z.object({
  shop: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  productTitle: z.string().min(1),
  variantTitle: z.string().min(1),
  email: z.string().email(),
});

// CORS: storefronts call this from the customer's browser, so allow cross-origin.
function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
    );
  }

  const { shop, productId, variantId, productTitle, variantTitle, email } = parsed.data;

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) {
    return withCors(NextResponse.json({ error: "Shop not found / app not installed" }, { status: 404 }));
  }

  const plan = PLANS[shopRecord.plan as PlanKey] ?? PLANS.free;
  if (plan.subscriberCap !== Infinity) {
    const count = await db.variantSubscriber.count({ where: { shopId: shopRecord.id, notified: false } });
    if (count >= plan.subscriberCap) {
      return withCors(
        NextResponse.json(
          { error: "Free plan limit reached. Upgrade to Pro for unlimited alerts." },
          { status: 402 }
        )
      );
    }
  }

  await db.variantSubscriber.upsert({
    where: {
      shopId_variantId_email: { shopId: shopRecord.id, variantId, email },
    },
    update: {},
    create: {
      shopId: shopRecord.id,
      productId,
      variantId,
      productTitle,
      variantTitle,
      email,
    },
  });

  return withCors(NextResponse.json({ success: true }));
}
