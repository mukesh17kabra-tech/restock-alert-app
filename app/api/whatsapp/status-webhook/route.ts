import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Twilio POSTs form-encoded status updates here whenever a Sender's status
// changes (e.g. pending -> online once the merchant completes the
// Twilio-hosted embedded signup and Meta approves the number).
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const senderSid = formData.get("SenderSid")?.toString();
  const status = formData.get("Status")?.toString();
  const senderId = formData.get("SenderId")?.toString(); // e.g. "whatsapp:+91XXXXXXXXXX"

  if (!senderSid) {
    return NextResponse.json({ error: "Missing SenderSid" }, { status: 400 });
  }

  const shopRecord = await db.shop.findFirst({ where: { twilioSenderSid: senderSid } });
  if (!shopRecord) {
    // Not one of ours (or already deleted) — acknowledge without erroring,
    // Twilio doesn't need a retry here.
    return NextResponse.json({ ok: true });
  }

  const whatsappNumber = senderId?.replace("whatsapp:", "");

  await db.shop.update({
    where: { id: shopRecord.id },
    data: {
      whatsappSenderStatus: status,
      ...(whatsappNumber ? { whatsappNumber } : {}),
      ...(status === "online" ? { whatsappConnectedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
