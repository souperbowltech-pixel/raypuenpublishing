import { publisherBrand } from "@/lib/book";

/**
 * The frame every admin screen shares. Signed in, it carries the header Ray
 * uses to move between the overview and the campaign and to sign out; signed
 * out, it is a narrow card that holds only the sign-in form.
 */

type Section = "overview" | "campaign";

const NAV: { id: Section; href: string; label: string }[] = [
  { id: "overview", href: "/admin", label: "Overview" },
  { id: "campaign", href: "/admin/campaign", label: "Campaign" },
];

const LINK = "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function AdminShell({ children, current }: { children: React.ReactNode; current: Section }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink/10 bg-paper-deep">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <p className="font-display text-lg font-bold text-ink">Puen Publishing admin</p>
          <nav aria-label="Admin" className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={item.href}
                aria-current={item.id === current ? "page" : undefined}
                className={`${LINK} ${item.id === current ? "bg-ink text-paper" : "text-ink hover:bg-ink/5"}`}
              >
                {item.label}
              </a>
            ))}
            <a href="/" className={`${LINK} text-ink-soft underline hover:text-ink`}>Back to the site</a>
            <form method="POST" action="/api/admin/session?signout=1">
              <button type="submit" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink-soft underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">{children}</main>
      <p className="pb-8 text-center text-xs text-ink-soft/80">{publisherBrand.fullCredit}</p>
    </div>
  );
}

/** The signed-out frame: one focused card and nothing else to choose from. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-ink/10 bg-paper p-6 shadow-card sm:p-8">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-ink-soft/80">{publisherBrand.fullCredit}</p>
    </main>
  );
}

/** One figure in a summary row, optionally a link, highlighted when it needs action. */
export function StatCard({ label, value, href, alert }: { label: string; value: React.ReactNode; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="block text-sm font-semibold text-ink-soft">{label}</span>
      <span className={`mt-1 block font-display font-bold ${typeof value === "number" ? "text-3xl tabular-nums" : "text-xl"} ${alert ? "text-clay-dark" : "text-ink"}`}>{value}</span>
    </>
  );
  const frame = `block rounded-2xl border-2 p-4 ${alert ? "border-clay bg-clay/10" : "border-ink/10 bg-white"}`;
  return href ? (
    <a href={href} className={`${frame} transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}>{body}</a>
  ) : (
    <div className={frame}>{body}</div>
  );
}
