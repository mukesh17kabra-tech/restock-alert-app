import { Resend } from "resend";

// Lazily construct the client on first use, inside a request, instead of at
// module load time. Next.js evaluates route modules during the build's
// "collecting page data" step — if RESEND_API_KEY isn't available yet at
// that point (or the constructor runs before env is injected), building
// eagerly here throws and fails the whole build.
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set — add it in Vercel's env vars.");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendRestockEmail(params: {
  to: string;
  productTitle: string;
  variantTitle: string;
  productUrl: string;
}) {
  const { to, productTitle, variantTitle, productUrl } = params;

  return getResend().emails.send({
    from: process.env.EMAIL_FROM || "alerts@yourapp.com",
    to,
    subject: `Back in stock: ${productTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Good news — it's back!</h2>
        <p><strong>${productTitle}</strong> (${variantTitle}) is back in stock.</p>
        <a href="${productUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Shop now
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          You're getting this because you asked to be notified when this item restocked.
        </p>
      </div>
    `,
  });
}

// Growth/Pro perk: a single follow-up nudge if the shopper hasn't ordered
// within 48h of the original restock email and stock is still available.
export async function sendReminderEmail(params: {
  to: string;
  productTitle: string;
  variantTitle: string;
  productUrl: string;
}) {
  const { to, productTitle, variantTitle, productUrl } = params;

  return getResend().emails.send({
    from: process.env.EMAIL_FROM || "alerts@yourapp.com",
    to,
    subject: `Still available: ${productTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Still in stock — for now</h2>
        <p><strong>${productTitle}</strong> (${variantTitle}) is still available, but items
        that restock from a waitlist tend to sell out again fast.</p>
        <a href="${productUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Shop now
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          This is a one-time reminder. You won't be emailed again about this item.
        </p>
      </div>
    `,
  });
}
