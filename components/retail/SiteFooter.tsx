import { siteMeta, publisherBrand } from "@/lib/book";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink/10 bg-paper-deep">
      <div className="container-page flex flex-col gap-3 py-10 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-ink">
            {siteMeta.name}
          </p>
          <p className="text-xs text-ink-soft/80 mt-0.5">
            {publisherBrand.fullCredit}
          </p>
        </div>
        <p className="text-xs sm:text-right">
          © {new Date().getFullYear()} {publisherBrand.umbrellaName} · {publisherBrand.imprintName} Imprint. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
