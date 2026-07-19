import { redirect } from "next/navigation";
import { resolveShop } from "@/lib/shop-context";

// This is the App URL Shopify opens when a merchant clicks the app in
// their Admin sidebar. If we can determine the shop (from `shop` or by
// decoding `host`), send the merchant straight to the dashboard instead
// of showing this plain instructional page.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; host?: string }>;
}) {
  const { shop: shopParam, host } = await searchParams;
  const shop = resolveShop(shopParam, host);

  if (shop) {
    const params = new URLSearchParams({ shop });
    if (host) params.set("host", host);
    redirect(`/dashboard?${params.toString()}`);
  }

  // Only shown if someone opens the bare Vercel URL directly with no
  // shop/host param — e.g. you, testing, not a merchant inside Shopify Admin.
  return (
    <main className="min-h-screen bg-[#0B0D0F] text-[#E7E9EA] flex items-center justify-center">
      <div className="max-w-md text-center px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/80 mb-2">Shopify App</p>
        <h1 className="text-3xl font-semibold mb-4">Variant Restock Alerts</h1>
        <p className="text-white/60 text-sm leading-relaxed">
          Install this app on your Shopify store, then visit{" "}
          <code className="text-emerald-400">/api/auth?shop=your-store.myshopify.com</code>{" "}
          to begin the OAuth flow.
        </p>
      </div>
    </main>
  );
}
