import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRestockEmail } from "@/lib/email";
import crypto from "crypto";

// Verifies the request genuinely came from Shopify using the HMAC header.
function verifyHmac(rawBody: string, hmacHeader: string | null) {
  if (!hmacHeader) return false;
  const generated = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(rawBody, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(hmacHeader));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
  const shopDomain = req.headers.get("x-shopify-shop-domain");

  if (!verifyHmac(rawBody, hmacHeader)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }
  if (!shopDomain) {
    return NextResponse.json({ error: "Missing shop domain" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  // Shopify inventory_levels/update payload includes inventory_item_id + available.
  const { inventory_item_id, available } = payload;

  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return NextResponse.json({ error: "Unknown shop" }, { status: 404 });

  await db.webhookLog.create({
    data: { shopId: shop.id, topic: "inventory_levels/update", payload },
  });

  // Only act when stock goes from 0 (or less) to something positive.
  if (available <= 0) {
    return NextResponse.json({ ok: true, skipped: "still out of stock" });
  }

  // NOTE: inventory_item_id maps to a variant, not stored directly here.
  // In production, resolve inventory_item_id -> variant_id via the Shopify API
  // (GET /admin/api/2024-10/inventory_items/{id}.json) or cache this mapping
  // when products are synced. For MVP simplicity we match on variantId directly
  // if you store inventory_item_id as variantId at subscribe time.
  const pending = await db.variantSubscriber.findMany({
    where: { shopId: shop.id, variantId: String(inventory_item_id), notified: false },
  });

  for (const sub of pending) {
    try {
      await sendRestockEmail({
        to: sub.email,
        productTitle: sub.productTitle,
        variantTitle: sub.variantTitle,
        productUrl: `https://${shopDomain}/products/${sub.productId}`,
      });
      await db.variantSubscriber.update({
        where: { id: sub.id },
        data: { notified: true, notifiedAt: new Date() },
      });
    } catch (err) {
      console.error(`Failed to notify ${sub.email}:`, err);
    }
  }

  return NextResponse.json({ ok: true, notified: pending.length });
}
