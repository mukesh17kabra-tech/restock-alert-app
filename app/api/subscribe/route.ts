import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { PLANS, PlanKey } from "@/lib/billing";

// email and phone are both optional at the schema level — the widget only
// asks for whichever channel(s) the merchant enabled (see notifyChannels
// on Shop), but we still require at least one contact method below.
const schema = z
  .object({
    shop: z.string().min(1),
    productId: z.string().min(1),
    variantId: z.string().min(1),
    productTitle: z.string().min(1),
    variantTitle: z.string().min(1),
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().min(8).optional(), // E.164, e.g. +91XXXXXXXXXX
  })
  .refine((data) => data.email || data.phone, {
    message: "Provide at least an email or a phone number",
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

  const { shop, productId, variantId, productTitle, variantTitle, name, email, phone } = parsed.data;

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

  // Prevent exact duplicate signups (same variant + same contact method).
  const existing = await db.variantSubscriber.findFirst({
    where: {
      shopId: shopRecord.id,
      variantId,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  });

  if (!existing) {
    await db.variantSubscriber.create({
      data: { shopId: shopRecord.id, productId, variantId, productTitle, variantTitle, name, email, phone },
    });
  }

  return withCors(NextResponse.json({ success: true }));
}
