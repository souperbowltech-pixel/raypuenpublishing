import { shippingReturns } from "@/lib/book";
import { Reveal } from "@/components/ui/Reveal";

const items = [
  {
    title: "Shipping",
    body: shippingReturns.shipping,
  },
  {
    title: "Returns",
    body: shippingReturns.returns,
  },
  {
    title: "Secure checkout",
    body: "256-bit encrypted checkout powered by Stripe. All major credit and debit cards accepted securely.",
  },
];

export function ShippingReturns() {
  return (
    <section className="container-page pb-8">
      <Reveal className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-xl2 border border-ink/10 bg-paper-deep p-6"
          >
            <h3 className="font-display text-lg font-semibold text-ink">
              {item.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {item.body}
            </p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
