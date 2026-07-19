// Shopify doesn't always pass a plain `shop` query param when opening an
// embedded app from Admin — sometimes just `host` (base64 of the shop's
// admin URL). Every page that needs the shop domain uses this helper.
export function resolveShop(shopParam?: string, host?: string): string | null {
  if (shopParam) return shopParam;
  if (!host) return null;
  try {
    const decoded = Buffer.from(host, "base64").toString("utf-8");
    const match = decoded.match(/^([a-zA-Z0-9-]+\.myshopify\.com)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
