import type { Metadata } from "next";
import Link from "next/link";
import { WholesaleForm } from "@/components/institutions/WholesaleForm";
import { formatCurrency, SPONSOR_TIERS } from "@/lib/pricing";
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
    "Flat-rate book sponsorship packages for schools, preschools, churches and libraries.",
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
          <p className="eyebrow">Bulk & sponsorship</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-ink sm:text-5xl">
            Coloring books for your whole classroom
          </h1>
          <p className="mt-4 text-lg text-ink-soft">
            Sponsor books for schools, preschools, churches and libraries with
            a flat-rate package — from{" "}
            <span className="font-semibold text-ink">
              {formatCurrency(SPONSOR_TIERS[1].flatPrice)}
            </span>{" "}
            for {SPONSOR_TIERS[1].booksSponsored} books to{" "}
            <span className="font-semibold text-ink">
              {formatCurrency(SPONSOR_TIERS[3].flatPrice)}
            </span>{" "}
            for {SPONSOR_TIERS[3].booksSponsored}. Every package is matched
            1:1, doubling the number of books printed.
          </p>
        </div>

        {/* Perks strip ------------------------------------------------- */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              t: "Flat-rate packages",
              d: `${formatCurrency(SPONSOR_TIERS[1].flatPrice)}, ${formatCurrency(SPONSOR_TIERS[2].flatPrice)} or ${formatCurrency(SPONSOR_TIERS[3].flatPrice)} — no per-copy math.`,
            },
            {
              t: "1:1 match",
              d: "We match every package to print double the books.",
            },
            {
              t: "Free author copy",
              d: "Tiers 2 & 3 ship one complimentary copy to you.",
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
