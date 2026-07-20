import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWhatsAppSender } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const shop = body?.shop as string | undefined;
  const code = body?.code as string | undefined;

  if (!shop || !code) {
    return NextResponse.json({ success: false, error: "Missing shop or code" }, { status: 400 });
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord?.twilioSenderSid) {
    return NextResponse.json(
      { success: false, error: "No pending WhatsApp connection found for this shop" },
      { status: 404 }
    );
  }

  try {
    const result = await verifyWhatsAppSender(shopRecord.twilioSenderSid, code);

    await db.shop.update({
      where: { shopDomain: shop },
      data: {
        whatsappSenderStatus: result.status,
        ...(result.status === "ONLINE" ? { whatsappConnectedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({ success: true, status: result.status });
  } catch (err) {
    console.error(`[whatsapp/verify] Failed for ${shop}:`, err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
