import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { campaignAdminSignedIn, deliveryLabel } from "@/lib/campaign-admin";
import { campaignAdminData, CAMPAIGN_PAGE_SIZE } from "@/lib/campaign-store";
import { pageCursor, parsePageCursor } from "@/lib/page-cursor";
import { CHARACTER_NAMES } from "@/lib/campaign";
import { CampaignEmailRetry } from "@/components/campaign/CampaignEmailRetry";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaign Results | Puen Publishing", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function CampaignAdminPage({ searchParams }: { searchParams: { before?: string } }) {
  if (!await campaignAdminSignedIn(cookies().get(ADMIN_COOKIE)?.value)) return <main className="p-8"><h1 className="font-display text-2xl">Campaign results</h1><p className="mt-4">Please sign in to the admin page first.</p><a href="/admin" className="btn-primary mt-4 inline-flex">Open Admin Sign-In</a></main>;
  const before = typeof searchParams.before === "string" ? searchParams.before : undefined;
  const data = await campaignAdminData(before);
  return <main className="min-h-screen bg-paper px-4 py-10"><div className="mx-auto max-w-5xl">
    <a href="/admin" className="inline-flex min-h-11 items-center underline">Back to Admin</a>
    <h1 className="mt-4 font-display text-3xl font-bold text-ink">Character Vote Campaign</h1>
    {!data ? <p role="alert" className="mt-5 text-clay">Campaign records could not be loaded. Please reload to try again.</p> : <>
      <dl className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Votes", data.summary.votes], ["Reservations", data.summary.reservations], ["Pending emails", data.summary.pendingEmails], ["Emails needing attention", data.summary.failedEmails]].map(([label, value]) => <div key={label} className="rounded-xl bg-white p-4"><dt className="text-sm text-ink-soft">{label}</dt><dd className="mt-1 text-2xl font-bold text-ink">{value}</dd></div>)}</dl>
      <h2 className="font-display text-xl font-bold text-ink">Votes by character and source</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">{data.summary.groups.map((g) => <li key={`${g.character}/${g.source}`} className="rounded-lg bg-white p-3">{CHARACTER_NAMES[g.character]} / {g.source}: <strong>{g.votes}</strong></li>)}</ul>
      <div className="my-6 flex flex-wrap gap-4"><a className="btn-secondary inline-flex min-h-11" href={`/api/admin/campaign?format=csv${before ? `&before=${encodeURIComponent(before)}` : ""}`}>Download This Page as CSV</a>
        {parsePageCursor(before) && <a href="/admin/campaign" className="inline-flex min-h-11 items-center underline">Back to Newest</a>}</div>
      <p className="mb-4 text-sm text-ink-soft">Each page and CSV holds up to 50 records. Votes are requests from email addresses, not verified unique families. Email acceptance does not prove inbox delivery.</p>
      {data.rows.length === 0 && <p className="rounded-xl bg-white p-5">No campaign records on this page.</p>}
      <ul className="space-y-4">{data.rows.map((r) => <li key={r.id} className="rounded-2xl border border-ink/15 bg-white p-5">
        <h2 className="font-display text-lg font-bold">{r.firstName} chose {CHARACTER_NAMES[r.character]}</h2>
        {r.revoked && <p className="mt-2 font-semibold text-clay">Withdrawn. Downloads and queued delivery are closed.</p>}
        <p className="mt-2 break-words text-ink-soft">{r.email}{r.phone ? ` / ${r.phone}` : ""}</p>
        <p className="mt-2 text-sm text-ink-soft">Source: {r.source} / Received: {new Date(r.createdAt).toISOString()} / Email updates: {r.marketingConsent ? "yes" : "no"} / Text permission: {r.smsConsent ? "yes" : "no"}</p>
        {r.answer && <p className="mt-3 whitespace-pre-wrap break-words">{r.answer}</p>}
        {r.quantity && <p className="mt-3 font-semibold">Reserved interest: {r.quantity} copies. Not a paid order.</p>}
        <p className="mt-3 text-sm">Kit email: {deliveryLabel(r, "welcome")}</p><p className="mb-3 text-sm">Owner notice: {deliveryLabel(r, "reservation")}</p>
        {!r.revoked && r.deliveries.some((d) => !d.sent && !d.busy) && <CampaignEmailRetry voteId={r.id} />}
      </li>)}</ul>
      {data.rows.length === CAMPAIGN_PAGE_SIZE && <a className="btn-secondary mt-6 inline-flex min-h-11" href={`/admin/campaign?before=${encodeURIComponent(pageCursor(data.rows[data.rows.length - 1]))}`}>Older Records</a>}
    </>}
  </div></main>;
}
