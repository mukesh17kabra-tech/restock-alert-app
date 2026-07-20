import Link from "next/link";

// Shared top navigation across the embedded app's pages. Keeps `shop` and
// `host` query params attached to every link so Shopify's embedded context
// (App Bridge) doesn't get lost when navigating between sections.
export function NavBar({
  shop,
  host,
  active,
}: {
  shop: string;
  host?: string | null;
  active: "dashboard" | "widget-setup" | "plans" | "whatsapp";
}) {
  const qs = new URLSearchParams({ shop });
  if (host) qs.set("host", host);
  const query = qs.toString();

  const items: { key: typeof active; label: string; href: string }[] = [
    { key: "dashboard", label: "Dashboard", href: `/dashboard?${query}` },
    { key: "widget-setup", label: "Widget setup", href: `/dashboard/widget-setup?${query}` },
    { key: "whatsapp", label: "WhatsApp", href: `/dashboard/whatsapp?${query}` },
    { key: "plans", label: "Plans", href: `/dashboard/plans?${query}` },
  ];

  return (
    <nav className="mb-8 flex gap-1 border-b border-white/10">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === item.key
              ? "border-emerald-400 text-white"
              : "border-transparent text-white/50 hover:text-white/80"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
