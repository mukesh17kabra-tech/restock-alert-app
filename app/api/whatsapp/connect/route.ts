import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createWhatsAppSender } from "@/lib/twilio";

// Step 1 of onboarding: merchant submits their WhatsApp number, we create
// a Twilio Sender for it — this triggers Twilio to send an OTP (SMS/call)
// to that number. The frontend follows up with the OTP in a second step
// (see app/api/whatsapp/verify/route.ts).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const shop = body?.shop as string | undefined;
  const whatsappNumber = body?.whatsappNumber as string | undefined; // E.164

  if (!shop || !whatsappNumber) {
    return NextResponse.json({ success: false, error: "Missing shop or whatsappNumber" }, { status: 400 });
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) {
    return NextResponse.json({ success: false, error: "Shop not found" }, { status: 404 });
  }

  try {
    const sender = await createWhatsAppSender({
      whatsappNumber,
      webhookUrl: `${process.env.HOST}/api/whatsapp/status-webhook`,
    });

    await db.shop.update({
      where: { shopDomain: shop },
      data: {
        twilioSenderSid: sender.sid,
        whatsappNumber,
        whatsappSenderStatus: sender.status,
      },
    });

    return NextResponse.json({ success: true, senderSid: sender.sid, status: sender.status });
  } catch (err) {
    console.error(`[whatsapp/connect] Failed for ${shop}:`, err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
