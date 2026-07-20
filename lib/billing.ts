const API_VERSION = "2024-10";

// Central place to define plan pricing so it's consistent across the app.
// whatsappMessageCap: Infinity is intentionally never used here — every
// paid tier has a hard monthly cap, because unlike storage/signups, each
// WhatsApp message costs real money (~₹0.40/message via Meta). Uncapped
// WhatsApp sending scales your cost with usage but not your revenue —
// see the "why not unlimited WhatsApp" discussion this structure came from.
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    subscriberCap: 50,
    whatsappMessageCap: 0, // WhatsApp channel is locked entirely on Free
  },
  starter: {
    name: "Starter",
    price: 3.99,
    subscriberCap: 100,
    whatsappMessageCap: 30,
  },
  growth: {
    name: "Growth",
    price: 8.99,
    subscriberCap: 200,
    whatsappMessageCap: 250,
  },
  pro: {
    name: "Pro",
    price: 14.99,
    subscriberCap: Infinity,
    whatsappMessageCap: 500,
  },
  business: {
    name: "Business",
    price: 24.99,
    subscriberCap: Infinity,
    whatsappMessageCap: 1000,
    overagePricePerThousand: 5, // $5 per extra 1,000 WhatsApp messages, auto-billed
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Creates a recurring application charge for the given paid plan and returns
// the confirmation URL the merchant must visit to approve billing (Shopify
// hosts this page — you don't build any billing UI yourself).
export async function createRecurringCharge(
  shop: string,
  accessToken: string,
  planKey: Exclude<PlanKey, "free">
) {
  const plan = PLANS[planKey];

  const res = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        recurring_application_charge: {
          name: `Restock Alert — ${plan.name} Plan`,
          price: plan.price,
          return_url: `${process.env.HOST}/api/billing/callback?shop=${shop}&plan=${planKey}`,
          trial_days: 7,
          // Business tier needs capped_amount + terms so Shopify allows
          // usage charges (overage) against this recurring charge.
          ...(planKey === "business"
            ? {
                capped_amount: 500, // max $/month Shopify will auto-approve in usage charges
                terms: "$5 per additional 1,000 WhatsApp messages beyond the included 1,000/month",
              }
            : {}),
          test: process.env.SHOPIFY_BILLING_TEST_MODE === "true",
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to create charge: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.recurring_application_charge as {
    id: number;
    confirmation_url: string;
    status: string;
  };
}

// Reports overage usage against an active Business-tier recurring charge.
// Shopify bills the merchant automatically as part of their next invoice —
// no separate payment flow needed. Call this once per billing cycle with
// the total overage for that cycle (not per-message).
export async function createUsageCharge(
  shop: string,
  accessToken: string,
  recurringChargeId: string,
  amount: number,
  description: string
) {
  const res = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${recurringChargeId}/usage_charges.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        usage_charge: { description, price: amount },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to create usage charge: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Called after the merchant approves/declines on Shopify's confirmation page.
export async function activateCharge(shop: string, accessToken: string, chargeId: string) {
  const res = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}/activate.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to activate charge: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Checks the current status of a charge (accepted, declined, active, etc.)
export async function getCharge(shop: string, accessToken: string, chargeId: string) {
  const res = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/recurring_application_charges/${chargeId}.json`,
    { headers: { "X-Shopify-Access-Token": accessToken } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.recurring_application_charge as { id: number; status: string };
}
