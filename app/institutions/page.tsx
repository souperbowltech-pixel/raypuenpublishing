import type { Metadata } from "next";
import Link from "next/link";
import { WholesaleForm } from "@/components/institutions/WholesaleForm";
import {
  formatCurrency,
  wholesaleDiscountLabel,
  WHOLESALE_UNIT_PRICE,
  FREE_MANUAL_THRESHOLD,
  DIGITAL_FEE,
} from "@/lib/pricing";
import { siteMeta } from "@/lib/book";

/**
 * Hidden institutional wholesale portal.
 *
 * This route is intentionally NOT linked from the main navigation and is
 * flagged noindex so search engines do not surface it — it is reachable by
 * direct URL only, as specified.
 */
export const metadata: Metadata = {
  title: `Bulk & Institutional Orders — ${siteMeta.name}`,
  description:
    "Wholesale pricing for schools, preschools, churches and libraries.",
  robots: { index: false, follow: false },
};

export default function InstitutionsPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-spruce-dark text-paper">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-2xl font-bold">
            {siteMeta.name}
          </Link>
          <span className="rounded-full bg-paper/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Institutional portal
          </span>
        </div>
      </header>

      <main className="container-page py-12">
        {/* Intro ------------------------------------------------------- */}
        <div className="max-w-2xl">
          <p className="eyebrow">Bulk & wholesale</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-ink sm:text-5xl">
            Coloring books for your whole classroom
          </h1>
          <p className="mt-4 text-lg text-ink-soft">
            Special {wholesaleDiscountLabel()}-off pricing for schools,
            preschools, churches and libraries — just{" "}
            <span className="font-semibold text-ink">
              {formatCurrency(WHOLESALE_UNIT_PRICE)}
            </span>{" "}
            per book. Order{" "}
            <span className="font-semibold text-ink">
              {FREE_MANUAL_THRESHOLD} or more
            </span>{" "}
            and we&apos;ll waive the {formatCurrency(DIGITAL_FEE)} digital fee
            and include the Teacher&apos;s Master Manual free.
          </p>
        </div>

        {/* Perks strip ------------------------------------------------- */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              t: `${wholesaleDiscountLabel()} off retail`,
              d: `${formatCurrency(WHOLESALE_UNIT_PRICE)} per copy, every order.`,
            },
            {
              t: "Fee waived at 100+",
              d: `Skip the ${formatCurrency(DIGITAL_FEE)} digital fee on bulk orders.`,
            },
            {
              t: "Free Teacher's Manual",
              d: "Master Manual PDF included at 100+ copies.",
            },
          ].map((perk) => (
            <li
              key={perk.t}
              className="rounded-xl2 border border-ink/10 bg-paper-deep p-5"
            >
              <p className="font-display text-lg font-bold text-spruce-dark">
                {perk.t}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{perk.d}</p>
            </li>
          ))}
        </ul>

        {/* Form + live calculator ------------------------------------- */}
        <section className="mt-12">
          <h2 className="sr-only">Bulk order form</h2>
          <WholesaleForm />
        </section>
      </main>

      <footer className="mt-8 border-t border-ink/10 bg-paper-deep">
        <div className="container-page py-8 text-sm text-ink-soft">
          Questions about a large order? Reach us at{" "}
          <a
            href="mailto:support@puenpublishing.com"
            className="font-semibold text-ink underline hover:text-spruce-dark"
          >
            support@puenpublishing.com
          </a>
        </div>
      </footer>
    </div>
  );
}
