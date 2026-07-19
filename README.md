# Restock Alert — Shopify App

Notify shoppers by email the moment a specific out-of-stock **variant** comes
back in stock. Built with Next.js (App Router), Prisma, Neon Postgres, and
deployed on Vercel.

## What's included

- `app/api/auth` + `app/api/auth/callback` — Shopify OAuth install flow
- `app/api/webhooks/inventory` — receives `inventory_levels/update` webhooks,
  detects 0 → positive stock changes, emails waiting subscribers
- `app/api/subscribe` — public endpoint the storefront widget calls when a
  shopper signs up for an alert
- `public/widget.js` — drop-in script for product pages
- `app/dashboard` — merchant-facing view of pending/notified signups
- `prisma/schema.prisma` — Shop / VariantSubscriber / WebhookLog models

## 1. Create the Neon Postgres database

1. Go to https://console.neon.tech → New Project
2. Copy the **pooled** connection string → `DATABASE_URL`
3. Copy the **direct** connection string → `DIRECT_URL`
   (Neon shows both — direct is required for Prisma migrations to work reliably)

## 2. Create the Shopify app (Partner Dashboard)

1. https://partners.shopify.com → Apps → Create app → "Create app manually"
2. App URL: `https://your-app.vercel.app`
3. Allowed redirection URL: `https://your-app.vercel.app/api/auth/callback`
4. Copy the API key/secret into `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`
5. Required scopes: `read_products,read_inventory,read_locations,read_themes,write_themes`
   (`read_locations` is required alongside `read_inventory` for the
   `inventory_levels/update` webhook to validate. `read_themes`/`write_themes`
   are required for the one-click "auto-install widget" button, which reads
   and edits the merchant's theme files via the Asset API — both scopes are
   needed even though `write_themes` sounds like it should cover reading too.
   Note: registering webhooks via the Admin API doesn't need its own scope —
   there's no such thing as a `write_webhooks` scope, despite how it sounds.)

A `shopify.app.toml` is included in this repo if you'd rather manage the app
via the Shopify CLI (`shopify app dev` / `shopify app deploy`) instead of
clicking through the Partner Dashboard UI. Open it and replace `client_id`
and the URLs with your real app's values — everything in it (scopes,
redirect URL, the inventory webhook) mirrors what's hardcoded in `lib/shopify.ts`
and the `.env` variables, so keep both in sync if you change one.
If you use the CLI, run `shopify app config link` first to connect this
file to your Partner Dashboard app, then `shopify app deploy` to push the
config (webhook subscriptions, scopes, URLs) to Shopify.

## 3. Set environment variables

Copy `.env.example` to `.env` locally, and add the same variables in
Vercel → Project → Settings → Environment Variables.

## 4. Install dependencies & generate Prisma client

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init   # creates tables in Neon
```

## 5. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect the GitHub repo in the Vercel dashboard for auto-deploys on push.
After the first deploy, update `HOST` in your env vars to the real Vercel URL,
and update the Shopify Partner app's App URL / redirect URL to match.

## 6. Install the app on a test store

Visit:
```
https://your-app.vercel.app/api/auth?shop=your-test-store.myshopify.com
```
This starts OAuth, stores the access token in Neon, and registers the
inventory webhook automatically.

## 7. Deploy the Theme App Extension (recommended way merchants add the widget)

This repo includes a Theme App Extension at
`extensions/restock-alert-widget/` — a drag-and-drop block merchants add
from the theme editor (Online Store → Themes → Customize → Add block →
Apps → Restock Alert). No code editing required on their end.

Deploy it along with your app config:
```bash
shopify app deploy
```
This is the **only supported way** to have your app write into a
merchant's theme. Shopify's older approach — writing theme files directly
via API (REST Assets or the GraphQL `themeFilesUpsert` mutation) — is
locked behind a manual exemption Shopify grants only to a small set of
theme-customization apps; regular apps get an `ACCESS_DENIED` error even
with `write_themes` granted. Don't build around that API — use a Theme
App Extension instead, as this repo already does.

### Manual snippet (fallback for legacy/vintage themes only)

If a merchant's theme predates Online Store 2.0 and doesn't support app
blocks, they can paste this into a Custom Liquid block on their product
template instead:

```liquid
<div id="restock-alert-widget"
     data-shop="{{ shop.permanent_domain }}"
     data-product-id="{{ product.id }}"
     data-variant-id="{{ product.selected_or_first_available_variant.id }}"
     data-product-title="{{ product.title | escape }}"
     data-variant-title="{{ product.selected_or_first_available_variant.title | escape }}">
</div>
<script src="https://your-app.vercel.app/widget.js" async></script>
```

Show it only when the variant is sold out — wrap it in
`{% unless product.selected_or_first_available_variant.available %} ... {% endunless %}`.

The in-app "Widget setup" tab (`/dashboard/widget-setup`) shows both
options to the merchant directly, recommending the app block first.

## Important note on the inventory webhook

Shopify's `inventory_levels/update` payload gives you an `inventory_item_id`,
not a `variant_id` directly. This starter matches subscribers using
`variantId`, so in production you should either:
- store the `inventory_item_id` as the subscriber's "variantId" at signup time
  (fetch it once via the Admin API when the widget loads), or
- maintain an `inventory_item_id -> variant_id` mapping table synced from
  `products/update` webhooks.

The subscribe/webhook code is structured so this is a small, isolated change.

## Monetization

Plan pricing lives in one place: `lib/billing.ts` → `PLANS`.

| Plan | Price | Subscriber cap | Extra perk | Trial |
|--------|--------|------------------|--------------------------------|-------|
| Free   | $0     | 50 active signups | —                              | —     |
| Growth | $7.99/mo | 200 active signups | 48h follow-up reminder email | 7 days |
| Pro    | $19/mo | Unlimited | 48h follow-up reminder + priority send | 7 days |

- The cap is enforced in `app/api/subscribe/route.ts` — once a shop hits its
  plan's signup cap, new signups get a 402 response telling the storefront
  widget to show an "upgrade needed" state.
- `app/api/billing/upgrade?shop=...&plan=growth|pro` starts a Shopify
  `recurring_application_charge` for the chosen plan and redirects the
  merchant to Shopify's own hosted approval page (you don't build this UI —
  Shopify shows price, trial, and Accept/Decline).
- `app/api/billing/callback` runs after the merchant approves or declines:
  it activates the charge with Shopify and sets `Shop.plan` to whichever
  plan was requested. If declined, the shop keeps its previous plan.
- The dashboard (`app/dashboard`) shows plan cards with real "Upgrade" links
  for any plan above the shop's current one.
- Set `SHOPIFY_BILLING_TEST_MODE=true` in your env while testing — Shopify
  will simulate the charge without actually billing (required for dev stores).

### The 48h reminder (Growth + Pro perk)

A real feature, not just marketing copy: if a shopper gets a restock email
but hasn't ordered within 48 hours and the item is still in stock, they get
one follow-up nudge ("Still available — items from a waitlist restock tend
to sell out again"). This is handled by:

- `VariantSubscriber.reminderSent` — tracks whether the follow-up went out
- `app/api/cron/reminders` — checks for eligible subscribers and sends the
  reminder, gated to `growth`/`pro` shops only
- `vercel.json` — schedules this route to run daily via Vercel Cron
- `CRON_SECRET` env var — protects the route so only Vercel's scheduler
  (or you, manually, with the right header) can trigger it

To change pricing later, edit the `price`/`subscriberCap` values in
`lib/billing.ts` — the dashboard, subscribe route, and billing routes all
read from that single source of truth.

## Next steps to make this production-ready

- Add the `products/update` webhook to keep product/variant titles in sync
- Add uninstall webhook (`app/uninstalled`) to clean up Shop rows and cancel
  any active recurring charge
- Add embedded-app authentication (App Bridge) so `/dashboard` is only
  viewable inside the Shopify Admin iframe, not as a bare public URL
- Handle the case where a Pro merchant's charge is cancelled/frozen by
  Shopify (e.g. failed payment) — listen for the `app_subscriptions/update`
  webhook and downgrade `Shop.plan` back to `"free"`
