const API_VERSION = "2024-10";

export function getInstallUrl(shop: string, state: string) {
  const scopes = "read_products,read_inventory,read_locations";
  const redirectUri = `${process.env.HOST}/api/auth/callback`;
  const clientId = process.env.SHOPIFY_API_KEY;
  return (
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri!)}` +
    `&state=${state}`
  );
}

export async function exchangeCodeForToken(shop: string, code: string) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; scope: string }>;
}

// Registers the inventory_levels/update webhook so we know the moment
// a variant's inventory changes (used to detect restocks).
export async function registerInventoryWebhook(shop: string, accessToken: string) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/webhooks.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      webhook: {
        topic: "inventory_levels/update",
        address: `${process.env.HOST}/api/webhooks/inventory`,
        format: "json",
      },
    }),
  });
  return res.json();
}

export async function getVariant(shop: string, accessToken: string, variantId: string) {
  const res = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/variants/${variantId}.json`,
    { headers: { "X-Shopify-Access-Token": accessToken } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.variant;
}
