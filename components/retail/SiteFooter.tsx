import { siteMeta } from "@/lib/book";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink/10 bg-paper-deep">
      <div className="container-page flex flex-col gap-3 py-10 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg font-semibold text-ink">
          {siteMeta.name}
        </p>
        <p>
          © {new Date().getFullYear()} {siteMeta.name}. [Placeholder footer —
          real links added later.]
        </p>
      </div>
    </footer>
  );
}
