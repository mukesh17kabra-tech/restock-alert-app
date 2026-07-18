import { db } from "@/lib/db";
import type { VariantSubscriber } from "@prisma/client";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;

  if (!shop) {
    return <div className="p-8 text-sm text-gray-500">Missing shop parameter.</div>;
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });

  if (!shopRecord) {
    return <div className="p-8 text-sm text-gray-500">Shop not found. Please reinstall the app.</div>;
  }

  const [pending, notified, totalCount] = await Promise.all([
    db.variantSubscriber.findMany({
      where: { shopId: shopRecord.id, notified: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.variantSubscriber.count({ where: { shopId: shopRecord.id, notified: true } }),
    db.variantSubscriber.count({ where: { shopId: shopRecord.id } }),
  ]);

  return (
    <main className="min-h-screen bg-[#0B0D0F] text-[#E7E9EA] font-sans">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-10 flex items-baseline justify-between border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/80">Restock Alerts</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{shopRecord.shopDomain}</h1>
          </div>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/60">
            {shopRecord.plan} plan
          </span>
        </header>

        <section className="mb-10 grid grid-cols-3 gap-4">
          <Stat label="Waiting on restock" value={pending.length} />
          <Stat label="Emails sent" value={notified} />
          <Stat label="Total signups" value={totalCount} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/50">
            Pending alerts
          </h2>
          {pending.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-white/40">
              No one is waiting on a restock right now. Once shoppers sign up on out-of-stock
              variants, they'll show up here.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Variant</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((sub: VariantSubscriber) => (
                    <tr key={sub.id} className="border-t border-white/5">
                      <td className="px-4 py-3">{sub.productTitle}</td>
                      <td className="px-4 py-3 text-white/60">{sub.variantTitle}</td>
                      <td className="px-4 py-3 text-white/60">{sub.email}</td>
                      <td className="px-4 py-3 text-white/40">
                        {sub.createdAt.toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {shopRecord.plan !== "pro" && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-white/50">
              Plans
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {shopRecord.plan === "free" && (
                <PlanCard
                  name="Growth"
                  price="$7.99/mo"
                  perks={[
                    "200 active signups",
                    "Restock reminder if unopened after 48h",
                    "7-day free trial",
                  ]}
                  href={`/api/billing/upgrade?shop=${shopRecord.shopDomain}&plan=growth`}
                  ctaLabel="Upgrade to Growth"
                />
              )}
              <PlanCard
                name="Pro"
                price="$19/mo"
                perks={[
                  "Unlimited signups",
                  "Priority email delivery",
                  "Restock reminder if unopened after 48h",
                  "7-day free trial",
                ]}
                href={`/api/billing/upgrade?shop=${shopRecord.shopDomain}&plan=pro`}
                ctaLabel="Upgrade to Pro"
                highlight
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function PlanCard({
  name,
  price,
  perks,
  href,
  ctaLabel,
  highlight = false,
}: {
  name: string;
  price: string;
  perks: string[];
  href: string;
  ctaLabel: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 flex flex-col ${
        highlight
          ? "border-emerald-400/40 bg-emerald-400/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <p className="text-sm font-medium text-white/50 uppercase tracking-wide">{name}</p>
      <p className="mt-1 text-2xl font-semibold">{price}</p>
      <ul className="mt-4 space-y-2 text-sm text-white/70 flex-1">
        {perks.map((perk) => (
          <li key={perk} className="flex gap-2">
            <span className="text-emerald-400">·</span>
            {perk}
          </li>
        ))}
      </ul>
      <a
        href={href}
        className={`mt-5 inline-block rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
          highlight
            ? "bg-emerald-400 text-black hover:bg-emerald-300"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {ctaLabel}
      </a>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
