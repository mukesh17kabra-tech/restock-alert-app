import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRestockEmail } from "@/lib/email";
import { sendWhatsAppViaTwilio } from "@/lib/twilio";
import { PLANS, PlanKey } from "@/lib/billing";
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

  const plan = PLANS[shop.plan as PlanKey] ?? PLANS.free;

  for (const sub of pending) {
    const productUrl = `https://${shopDomain}/products/${sub.productId}`;
    let whatsappSent = false;

    const canSendWhatsApp =
      sub.phone &&
      shop.whatsappNumber &&
      shop.whatsappSenderStatus === "online" &&
      // Business tier has no hard ceiling here — it's billed as overage
      // instead of being blocked. Every other tier stops at its cap and
      // falls back to email so the customer still gets notified somehow.
      // testModeBypassCaps skips the cap entirely for your own testing.
      (shop.testModeBypassCaps ||
        shop.plan === "business" ||
        shop.whatsappMessagesThisCycle < plan.whatsappMessageCap);

    if (canSendWhatsApp) {
      try {
        // "restock_alert" Content Template must be created + approved once
        // in the Twilio Console (Content Editor) — see README for the
        // exact template body and how to get its Content SID.
        await sendWhatsAppViaTwilio({
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          fromWhatsAppNumber: shop.whatsappNumber!,
          to: sub.phone!,
          contentSid: process.env.TWILIO_RESTOCK_TEMPLATE_CONTENT_SID!,
          contentVariables: {
            "1": sub.name || "there",
            "2": sub.productTitle,
            "3": productUrl,
          },
        });
        whatsappSent = true;
        await db.shop.update({
          where: { id: shop.id },
          data: { whatsappMessagesThisCycle: { increment: 1 } },
        });
      } catch (err) {
        console.error(`Failed to WhatsApp ${sub.phone}:`, err);
      }
    }

    // Send email whenever the subscriber gave one, OR as a fallback when
    // they only gave a phone number but WhatsApp couldn't be sent (cap
    // reached, not connected, or the send failed) — so nobody misses out
    // on the notification entirely just because of a plan limit.
    const shouldEmailAsFallback = !whatsappSent && sub.phone && !sub.email;
    if (sub.email || shouldEmailAsFallback) {
      const emailTarget = sub.email; // fallback still requires an email on file
      if (emailTarget) {
        try {
          await sendRestockEmail({
            to: emailTarget,
            productTitle: sub.productTitle,
            variantTitle: sub.variantTitle,
            productUrl,
          });
        } catch (err) {
          console.error(`Failed to email ${emailTarget}:`, err);
        }
      }
    }

    await db.variantSubscriber.update({
      where: { id: sub.id },
      data: { notified: true, notifiedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, notified: pending.length });
}
