import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createWhatsAppSender } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const shop = body?.shop as string | undefined;

  if (!shop) {
    return NextResponse.json({ success: false, error: "Missing shop" }, { status: 400 });
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) {
    return NextResponse.json({ success: false, error: "Shop not found" }, { status: 404 });
  }

  try {
    const sender = await createWhatsAppSender({
      shop,
      webhookUrl: `${process.env.HOST}/api/whatsapp/status-webhook`,
    });

    const onboardingUrl = sender.embedded_signup_setup?.onboarding_url;
    if (!onboardingUrl) {
      throw new Error("Twilio did not return an onboarding URL");
    }

    await db.shop.update({
      where: { shopDomain: shop },
      data: {
        twilioSenderSid: sender.sid,
        whatsappSenderStatus: sender.status,
      },
    });

    return NextResponse.json({ success: true, onboardingUrl });
  } catch (err) {
    console.error(`[whatsapp/connect] Failed for ${shop}:`, err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
