import Link from "next/link";
import { siteMeta } from "@/lib/book";

/**
 * Public site header. Note: the institutional portal (/institutions) is
 * intentionally NOT linked here — it is reachable by direct URL only.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold text-ink">
            {siteMeta.name}
          </span>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-clay sm:inline">
            Coloring Books
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold text-ink-soft">
          <a href="#gallery" className="hidden hover:text-ink sm:inline">
            Gallery
          </a>
          <a href="#details" className="hidden hover:text-ink sm:inline">
            Details
          </a>
          <a href="#buy" className="btn-primary !px-5 !py-2 text-sm">
            Buy Now
          </a>
        </nav>
      </div>
    </header>
  );
}
