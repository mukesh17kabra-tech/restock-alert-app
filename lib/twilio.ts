const TWILIO_API_BASE = "https://messaging.twilio.com/v2";

function authHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

// ---- Sender onboarding ----
//
// Twilio is itself a Meta-verified WhatsApp Tech Provider. Their "Senders"
// API lets you register a merchant's WhatsApp number under YOUR Twilio
// account, using a Twilio-hosted embedded signup link — the merchant just
// clicks it and confirms their number. They never create a Twilio account,
// and (unlike raw Meta Embedded Signup) they don't need their own Meta
// Business verification either, since Twilio's verification covers it.
// Docs: https://www.twilio.com/docs/whatsapp/self-sign-up

export async function createWhatsAppSender(params: {
  shop: string;
  webhookUrl: string; // where Twilio will POST status updates for this sender
}) {
  const { webhookUrl } = params;

  const res = await fetch(`${TWILIO_API_BASE}/Channels/Senders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "Sender.configuration.embedded_signup": "true",
      "Sender.webhook.callback_url": webhookUrl,
      "Sender.profile.name": "Restock Alerts",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create WhatsApp sender: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  // data.sid = sender SID (e.g. XExxxxxxxx)
  // data.embedded_signup_setup.onboarding_url = the link to send the merchant
  return data as {
    sid: string;
    status: string;
    embedded_signup_setup?: { onboarding_url?: string };
  };
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
