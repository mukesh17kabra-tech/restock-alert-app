const API_VERSION = "2024-10";

// Central place to define plan pricing so it's consistent across the app.
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    subscriberCap: 50,
  },
  growth: {
    name: "Growth",
    price: 7.99,
    subscriberCap: 200,
  },
  pro: {
    name: "Pro",
    price: 19.0,
    subscriberCap: Infinity,
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
