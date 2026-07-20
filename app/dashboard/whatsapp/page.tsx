import { db } from "@/lib/db";
import { resolveShop } from "@/lib/shop-context";
import { NavBar } from "@/components/NavBar";
import { ConnectWhatsAppButton } from "@/components/ConnectWhatsAppButton";
import { ChannelToggle } from "@/components/ChannelToggle";
import { PLANS, PlanKey } from "@/lib/billing";

export default async function WhatsAppPage({
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

  const isConnected = shopRecord.whatsappSenderStatus === "online";
  const isPending = !!shopRecord.twilioSenderSid && !isConnected;
  const plan = PLANS[shopRecord.plan as PlanKey] ?? PLANS.free;
  const whatsappAvailableOnPlan = plan.whatsappMessageCap > 0 || shopRecord.testModeBypassCaps;

  return (
    <main className="min-h-screen bg-[#0B0D0F] text-[#E7E9EA] font-sans">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/80">Restock Alerts</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{shopRecord.shopDomain}</h1>
        </header>

        <NavBar shop={shop} host={host} active="whatsapp" />

        {!whatsappAvailableOnPlan ? (
          <section className="max-w-2xl rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] p-6">
            <p className="text-sm font-medium text-white mb-1">
              WhatsApp is a Starter plan feature and above
            </p>
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              The Free plan only sends restock alerts by email. Upgrade to Starter
              ($3.99/mo) or higher to let shoppers get notified on WhatsApp too.
            </p>
            <a
              href={`/dashboard/plans?shop=${shopRecord.shopDomain}${host ? `&host=${host}` : ""}`}
              className="inline-block rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300 transition-colors"
            >
              View plans
            </a>
          </section>
        ) : (
          <section className="max-w-2xl space-y-8">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
              <p className="text-sm font-medium text-white mb-1">WhatsApp connection</p>
              {isConnected ? (
                <>
                  <p className="text-sm text-emerald-400 mb-4">
                    ✓ Connected — {shopRecord.whatsappNumber}
                  </p>
                  <p className="text-xs text-white/40 mb-1">
                    Connected on {shopRecord.whatsappConnectedAt?.toLocaleDateString()}. Restock
                    alerts will be sent from this number.
                  </p>
                  <p className="text-xs text-white/40">
                    {shopRecord.whatsappMessagesThisCycle} / {plan.whatsappMessageCap} messages
                    used this billing cycle
                    {shopRecord.plan === "business" ? " (overage billed automatically past this)" : ""}
                  </p>
                </>
              ) : isPending ? (
                <>
                  <p className="text-sm text-yellow-400 mb-4">
                    ⏳ Setup started — waiting for confirmation
                  </p>
                  <p className="text-xs text-white/40">
                    You started connecting a number. If you didn&apos;t finish the last step,
                    click below to pick up where you left off.
                  </p>
                  <div className="mt-4">
                    <ConnectWhatsAppButton shop={shop} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/60 mb-4 leading-relaxed">
                    Connect your own WhatsApp number so shoppers can get restock alerts there
                    too, not just by email. Click the button below — you&apos;ll just confirm
                    your number on a quick page, no account creation needed on your end.
                  </p>
                  <ConnectWhatsAppButton shop={shop} />
                </>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
              <p className="text-sm font-medium text-white mb-1">Notification channels</p>
              <p className="text-sm text-white/60 mb-4 leading-relaxed">
                Choose what the storefront popup collects and sends restock alerts through.
              </p>
              <ChannelToggle
                shop={shop}
                current={shopRecord.notifyChannels}
                whatsappConnected={isConnected}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
