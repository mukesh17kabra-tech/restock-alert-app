const TWILIO_API_BASE = "https://messaging.twilio.com/v2";

function authHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

// ---- Sender onboarding (two-step: create, then verify with OTP) ----
//
// Twilio's Senders API does NOT provide a hosted "click this link" signup
// page — the merchant's WhatsApp number must be known upfront, Twilio then
// sends that number an OTP (SMS or voice call) which the merchant reads off
// their phone and enters back into your app. This is still fully self-serve
// and needs no Twilio/Meta account on the merchant's end — just their phone
// in hand for a few seconds.
// Docs: https://www.twilio.com/docs/whatsapp/api/senders

export async function createWhatsAppSender(params: {
  whatsappNumber: string; // E.164, e.g. "+91XXXXXXXXXX"
  webhookUrl: string;
  verificationMethod?: "sms" | "voice";
}) {
  const { whatsappNumber, webhookUrl, verificationMethod = "sms" } = params;

  const res = await fetch(`${TWILIO_API_BASE}/Channels/Senders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_id: `whatsapp:${whatsappNumber}`,
      configuration: {
        verification_method: verificationMethod,
      },
      webhook: {
        callback_url: webhookUrl,
      },
      profile: {
        name: "Restock Alerts",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create WhatsApp sender: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<{ sid: string; status: string; sender_id: string }>;
}

// Submits the OTP code the merchant received via SMS/call to complete
// verification. On success, status moves toward "ONLINE".
export async function verifyWhatsAppSender(senderSid: string, verificationCode: string) {
  const res = await fetch(`${TWILIO_API_BASE}/Channels/Senders/${senderSid}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      configuration: { verification_code: verificationCode },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to verify sender: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<{ sid: string; status: string }>;
}

export async function getSenderStatus(senderSid: string) {
  const res = await fetch(`${TWILIO_API_BASE}/Channels/Senders/${senderSid}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) throw new Error(`Failed to fetch sender status: ${res.status}`);
  return res.json() as Promise<{ sid: string; status: string; sender_id: string }>;
}

// ---- Sending ----

const TWILIO_MESSAGES_API = "https://api.twilio.com/2010-04-01";

// Sends a pre-approved template message via a merchant's connected sender.
export async function sendWhatsAppViaTwilio(params: {
  accountSid: string;
  fromWhatsAppNumber: string; // the merchant's connected number, e.g. "+91XXXXXXXXXX"
  to: string; // customer's number, E.164
  contentSid: string; // Twilio Content Template SID (approved template)
  contentVariables: Record<string, string>; // {{1}}, {{2}}, ... fill-ins
}) {
  const { accountSid, fromWhatsAppNumber, to, contentSid, contentVariables } = params;

  const res = await fetch(`${TWILIO_MESSAGES_API}/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: `whatsapp:${fromWhatsAppNumber}`,
      To: `whatsapp:${to}`,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(contentVariables),
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
