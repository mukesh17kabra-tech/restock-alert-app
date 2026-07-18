export default function Home() {
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
