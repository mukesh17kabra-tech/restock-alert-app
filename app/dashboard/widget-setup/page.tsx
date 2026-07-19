import { db } from "@/lib/db";
import { resolveShop } from "@/lib/shop-context";
import { NavBar } from "@/components/NavBar";
import { CopySnippet } from "@/components/CopySnippet";

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

  const manualSnippet = `<div id="restock-alert-widget"
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
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] p-6">
            <p className="text-sm font-medium text-white mb-1">
              Recommended: add it from the theme editor (no code)
            </p>
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              This app includes a drag-and-drop block for your theme editor — no copying or
              editing code required.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-white/70 leading-relaxed">
              <li>Go to <strong>Online Store → Themes → Customize</strong></li>
              <li>Open a product page in the editor</li>
              <li>Click <strong>Add block</strong> in the section where you want the alert to appear</li>
              <li>Choose <strong>Apps → Restock Alert</strong></li>
              <li>Click <strong>Save</strong> — that&apos;s it</li>
            </ol>
            <p className="mt-4 text-xs text-white/40">
              The block only shows the &quot;Notify me&quot; form automatically when a variant
              is sold out — it stays hidden otherwise.
            </p>
          </div>

          <div className="border-t border-white/10 pt-8">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-white/50">
              Prefer to add it manually with code? (advanced)
            </h2>
            <p className="mb-4 text-sm text-white/60 leading-relaxed">
              Only needed if your theme doesn&apos;t support app blocks (very old/legacy
              themes). Paste this into a Custom Liquid block on your product template:
            </p>
            <CopySnippet code={manualSnippet} />
          </div>
        </section>
      </div>
    </main>
  );
}
