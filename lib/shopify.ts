const API_VERSION = "2024-10";

export function getInstallUrl(shop: string, state: string) {
  const scopes = "read_products,read_inventory,read_locations,read_themes,write_themes";
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

// ---- Theme file helpers (used by the "auto-install widget" button) ----
//
// Shopify's older REST "Asset" endpoint (themes/{id}/assets.json) is
// deprecated for apps created after a certain cutoff and returns 404 for
// them even with correct scopes. The supported replacement is the GraphQL
// Admin API's theme file query/mutation, so all theme reads/writes below
// go through GraphQL instead of REST.

async function shopifyGraphQL(shop: string, accessToken: string, query: string, variables: object) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// Finds the merchant's currently active (published) theme and returns its
// GraphQL GID (e.g. "gid://shopify/OnlineStoreTheme/123").
export async function getMainThemeGid(shop: string, accessToken: string): Promise<string> {
  const data = await shopifyGraphQL(
    shop,
    accessToken,
    `query {
      themes(first: 1, roles: [MAIN]) {
        nodes { id }
      }
    }`,
    {}
  );
  const theme = data?.themes?.nodes?.[0];
  if (!theme) throw new Error("No main (published) theme found");
  return theme.id as string;
}

// Reads a single theme file's text content, or null if it doesn't exist.
export async function getThemeFile(
  shop: string,
  accessToken: string,
  themeGid: string,
  filename: string
): Promise<string | null> {
  const data = await shopifyGraphQL(
    shop,
    accessToken,
    `query GetFile($id: ID!, $filenames: [String!]!) {
      theme(id: $id) {
        files(filenames: $filenames) {
          nodes {
            filename
            body {
              ... on OnlineStoreThemeFileBodyText { content }
            }
          }
        }
      }
    }`,
    { id: themeGid, filenames: [filename] }
  );
  const node = data?.theme?.files?.nodes?.[0];
  return node?.body?.content ?? null;
}

// Creates or overwrites a theme file.
export async function putThemeFile(
  shop: string,
  accessToken: string,
  themeGid: string,
  filename: string,
  content: string
) {
  const data = await shopifyGraphQL(
    shop,
    accessToken,
    `mutation UpsertFile($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        userErrors { field message }
      }
    }`,
    {
      themeId: themeGid,
      files: [{ filename, body: { type: "TEXT", value: content } }],
    }
  );
  const errors = data?.themeFilesUpsert?.userErrors;
  if (errors?.length) {
    throw new Error(`Theme file write rejected: ${JSON.stringify(errors)}`);
  }
  return data;
}
