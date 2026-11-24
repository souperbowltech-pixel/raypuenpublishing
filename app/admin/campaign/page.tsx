import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { campaignAdminSignedIn, deliveryLabel, pacificTime } from "@/lib/campaign-admin";
import { campaignAdminData, CAMPAIGN_PAGE_SIZE } from "@/lib/campaign-store";
import { pageCursor, parsePageCursor } from "@/lib/page-cursor";
import { CHARACTERS, CHARACTER_NAMES, sourceLabel, type Character } from "@/lib/campaign";
import { CampaignEmailRetry } from "@/components/campaign/CampaignEmailRetry";
import { AdminGate, AdminShell, StatCard } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaign Results | Puen Publishing", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Group = { character: Character; source: string; votes: number };

/** Votes per character, most popular first, each with its sources. */
function byCharacter(groups: Group[]) {
  return CHARACTERS.map((character) => {
    const rows = groups.filter((g) => g.character === character);
    return { character, total: rows.reduce((sum, g) => sum + g.votes, 0), sources: rows };
  }).sort((a, b) => b.total - a.total);
}

export default async function CampaignAdminPage({ searchParams }: { searchParams: { before?: string } }) {
  if (!await campaignAdminSignedIn(cookies().get(ADMIN_COOKIE)?.value)) {
    return (
      <AdminGate>
        <h1 className="font-display text-2xl font-bold text-ink">Campaign results</h1>
        <p className="mt-2 text-ink-soft">Please sign in to the admin page first.</p>
        <a href="/admin" className="btn-primary mt-6 inline-flex w-full justify-center">Sign in</a>
      </AdminGate>
    );
  }

  const before = typeof searchParams.before === "string" ? searchParams.before : undefined;
  const data = await campaignAdminData(before);
  const characters = data ? byCharacter(data.summary.groups) : [];
  const top = Math.max(1, ...characters.map((c) => c.total));

  return (
    <AdminShell current="campaign">
      <h1 className="font-display text-3xl font-bold text-ink">Character Vote Campaign</h1>
      {!data ? (
        <p role="alert" className="mt-5 rounded-xl border-2 border-clay bg-clay/10 p-4 font-semibold text-clay-dark">
          Campaign records could not be loaded. Please reload to try again.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Votes" value={data.summary.votes} />
            <StatCard label="Reservations" value={data.summary.reservations} />
            <StatCard label="Emails waiting" value={data.summary.pendingEmails} />
            <StatCard label="Emails needing attention" value={data.summary.failedEmails} alert={data.summary.failedEmails > 0} />
          </div>

          <section aria-labelledby="by-character" className="mt-10">
            <h2 id="by-character" className="font-display text-2xl font-bold text-ink">Votes by character</h2>
            <ul className="mt-4 space-y-4">
              {characters.map((c) => (
                <li key={c.character}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-ink">{CHARACTER_NAMES[c.character]}</span>
                    <span className="font-display text-xl font-bold tabular-nums text-ink">{c.total}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                    <div className="h-full rounded-full bg-spruce" style={{ width: `${(c.total / top) * 100}%` }} />
                  </div>
                  {c.sources.length > 0 && (
                    <p className="mt-1 text-sm text-ink-soft">
                      {c.sources.map((g) => `${sourceLabel(g.source)}: ${g.votes}`).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="records" className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="records" className="font-display text-2xl font-bold text-ink">Votes received</h2>
              <div className="flex flex-wrap items-center gap-3">
                {parsePageCursor(before) && (
                  <a href="/admin/campaign" className="inline-flex min-h-11 items-center font-semibold underline">Back to newest</a>
                )}
                <a className="btn-secondary inline-flex min-h-11" href={`/api/admin/campaign?format=csv${before ? `&before=${encodeURIComponent(before)}` : ""}`}>
                  Download this page as CSV
                </a>
              </div>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Each page and CSV holds up to 50 records. Votes are requests from email addresses, not verified unique families. Email acceptance does not prove inbox delivery.
            </p>

            {data.rows.length === 0 && <p className="mt-4 rounded-xl bg-white p-5">No campaign records on this page.</p>}
            <ul className="mt-4 space-y-4">
              {data.rows.map((r) => (
                <li key={r.id} className="rounded-2xl border border-ink/15 bg-white p-5">
                  <h3 className="font-display text-lg font-bold text-ink">{r.firstName} chose {CHARACTER_NAMES[r.character]}</h3>
                  {r.revoked && <p className="mt-2 font-semibold text-clay-dark">Withdrawn. Downloads and queued delivery are closed.</p>}
                  <p className="mt-1 break-words text-ink-soft">{r.email}{r.phone ? ` / ${r.phone}` : ""}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {[
                      ["Source", sourceLabel(r.source)],
                      ["Received", pacificTime(r.createdAt)],
                      ["Email updates", r.marketingConsent ? "Yes" : "No"],
                      ["Text permission", r.smsConsent ? "Yes" : "No"],
                      ["Kit email", deliveryLabel(r, "welcome")],
                      ["Owner notice", deliveryLabel(r, "reservation")],
                    ].map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <dt className="font-semibold text-ink-soft">{label}:</dt>
                        <dd className="break-words text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.answer && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-paper p-3">{r.answer}</p>}
                  {r.quantity && <p className="mt-3 font-semibold">Reserved interest: {r.quantity} copies. Not a paid order.</p>}
                  {!r.revoked && r.deliveries.some((d) => !d.sent && !d.busy) && <div className="mt-3"><CampaignEmailRetry voteId={r.id} /></div>}
                </li>
              ))}
            </ul>
            {data.rows.length === CAMPAIGN_PAGE_SIZE && (
              <a className="btn-secondary mt-6 inline-flex min-h-11" href={`/admin/campaign?before=${encodeURIComponent(pageCursor(data.rows[data.rows.length - 1]))}`}>
                Older records
              </a>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
