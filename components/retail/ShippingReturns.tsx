import { shippingReturns } from "@/lib/book";

const items = [
  {
    icon: "📦",
    title: "Shipping",
    body: shippingReturns.shipping,
  },
  {
    icon: "↩️",
    title: "Returns",
    body: shippingReturns.returns,
  },
  {
    icon: "🔒",
    title: "Secure checkout",
    body: "[Placeholder] Payments are processed securely. Card handling is added in Milestone 2.",
  },
];

export function ShippingReturns() {
  return (
    <section className="container-page pb-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-xl2 border border-ink/10 bg-paper-deep p-6"
          >
            <span className="text-2xl" aria-hidden>
              {item.icon}
            </span>
            <h3 className="mt-2 font-display text-lg font-semibold text-ink">
              {item.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
