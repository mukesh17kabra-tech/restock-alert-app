import { db } from "@/lib/db";
import { resolveShop } from "@/lib/shop-context";
import { NavBar } from "@/components/NavBar";
import { CopySnippet } from "@/components/CopySnippet";
import { AutoInstallButton } from "@/components/AutoInstallButton";

export default async function WidgetSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; host?: string }>;
}) {
  const { shop: shopParam, host } = await searchParams;
  const shop = resolveShop(shopParam, host);

  if (!shop) {
    return <div className="p-8 text-sm text-gray-500">Missing shop parameter.</div>;
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });

  if (!shopRecord) {
    return <div className="p-8 text-sm text-gray-500">Shop not found. Please reinstall the app.</div>;
  }

  const snippet = `<div id="restock-alert-widget"
     data-shop="{{ shop.permanent_domain }}"
     data-product-id="{{ product.id }}"
     data-variant-id="{{ product.selected_or_first_available_variant.id }}"
     data-product-title="{{ product.title | escape }}"
     data-variant-title="{{ product.selected_or_first_available_variant.title | escape }}">
</div>
<script src="${process.env.HOST}/widget.js" async></script>`;

  return (
    <main className="min-h-screen bg-[#0B0D0F] text-[#E7E9EA] font-sans">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/80">Restock Alerts</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{shopRecord.shopDomain}</h1>
        </header>

        <NavBar shop={shop} host={host} active="widget-setup" />

        <section className="max-w-2xl space-y-8">
          <AutoInstallButton shop={shop} />

          <div className="border-t border-white/10 pt-8">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-white/50">
              Prefer to add it manually? (advanced)
            </h2>
            <p className="mb-4 text-sm text-white/60 leading-relaxed">
              If you use a custom theme or the automatic install above didn&apos;t find your
              product template, follow these steps instead.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-white/50">
              1. Add the widget to your product template
            </h2>
            <p className="mb-4 text-sm text-white/60 leading-relaxed">
              In your Shopify theme editor, open your product template (or a Theme App
              Extension block) and paste this snippet. It shows a "Notify me" form only when
              the selected variant is sold out.
            </p>
            <CopySnippet code={snippet} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-white/50">
              2. Show it only when sold out
            </h2>
            <p className="mb-4 text-sm text-white/60 leading-relaxed">
              Wrap the snippet above in a Liquid condition so it only appears for out-of-stock
              variants:
            </p>
            <CopySnippet
              code={`{% unless product.selected_or_first_available_variant.available %}
  <!-- paste the widget snippet here -->
{% endunless %}`}
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-white/50">
              3. Where to add it in the theme editor
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-white/60 leading-relaxed">
              <li>Go to Online Store → Themes → Customize</li>
              <li>Open a product page</li>
              <li>Add a "Custom Liquid" block below the Buy Buttons block</li>
              <li>Paste the snippet from step 2 into that block</li>
              <li>Save, then visit a sold-out product to confirm the form appears</li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
