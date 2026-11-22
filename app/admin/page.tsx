import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, isAdminCookie } from "@/lib/admin-auth";
import { listPendingGuideClaims } from "@/lib/patrol-store";
import { formatAddress } from "@/lib/notifications";
import { publisherBrand } from "@/lib/book";
import { listSchoolRequests } from "@/lib/school-request-store";
import { parsePageCursor } from "@/lib/page-cursor";
import { SchoolRequestsList } from "@/components/admin/SchoolRequestsList";
import { listGrants } from "@/lib/library-store";
import { LibraryCodes } from "@/components/admin/LibraryCodes";
import { libraryBookOptions, libraryCodeRows, olderCodesCursor } from "@/lib/admin-library-rows";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin | Puen Publishing",
  robots: { index: false, follow: false },
};

/**
 * Where Ray approves a free printed Parent's Guide.
 *
 * His approval is half of the anti-fraud rule he chose, and until this page the
 * only way to reach a claim was the one-click link in an email. An email that
 * never arrives made a claim invisible. This page does not depend on a message
 * getting through.
 *
 * Below the approvals, the requests leaders send from /neighborhood, newest
 * first, for the same reason: the email to Ray is a courtesy, this list is the
 * record. Then the review codes Ray hands to reviewers (the private library).
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string; before?: string; lbefore?: string };
}) {
  if (!adminConfigured()) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold text-ink">Approvals are switched off</h1>
        <p className="mt-3 text-ink-soft">
          No admin key is configured for this site, so this page stays closed. Set{" "}
          <code className="rounded bg-ink/5 px-1.5 py-0.5 text-sm">ADMIN_TOKEN</code> (at least 16
          characters) and reload.
        </p>
      </Shell>
    );
  }

  if (!isAdminCookie(cookies().get(ADMIN_COOKIE)?.value)) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold text-ink">Approvals</h1>
        <p className="mt-2 text-ink-soft">Enter the admin key to continue.</p>
        <form method="POST" action="/api/admin/session" className="mt-6 space-y-3">
          <label htmlFor="key" className="block text-sm font-bold text-ink">
            Admin key
          </label>
          <input id="key" name="key" type="password" autoComplete="off" className="input" required />
          <button type="submit" className="btn-primary w-full">
            Open approvals
          </button>
        </form>
        <a href="/" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft underline">
          Back to the site
        </a>
        {searchParams.error && (
          <p className="mt-4 text-sm font-semibold text-clay">
            {searchParams.error === "rate"
              ? "Too many attempts. Please wait a minute."
              : "That key was not right."}
          </p>
        )}
      </Shell>
    );
  }

  const before = typeof searchParams.before === "string" ? searchParams.before : undefined;
  const codesBefore = typeof searchParams.lbefore === "string" ? searchParams.lbefore : undefined;
  const [claims, requests, grants] = await Promise.all([
    listPendingGuideClaims(),
    listSchoolRequests(before),
    listGrants(codesBefore),
  ]);

  return (
    <Shell wide>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Guides waiting for approval</h1>
        <div className="flex items-center gap-4">
          <a href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft underline">
            Back to the site
          </a>
          <form method="POST" action="/api/admin/session?signout=1">
            <button type="submit" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft underline">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {claims.length === 0 ? (
        <p className="mt-6 rounded-xl bg-ink/5 p-5 text-ink-soft">
          Nothing is waiting. A claim appears here the moment a Patrol reaches three of three
          families and asks for its free printed Guide.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {claims.map((claim) => (
            <li
              key={claim.approvalToken}
              className="rounded-2xl border-2 border-crayon-gold bg-paper-deep p-5"
            >
              <p className="font-display text-lg font-bold text-ink">{claim.recipientName}</p>
              <p className="mt-1 text-sm text-ink-soft">
                Claimed by {claim.leaderEmail} · {new Date(claim.createdAt).toLocaleDateString()}
              </p>
              <pre className="mt-3 whitespace-pre-line rounded-lg bg-paper p-3 font-sans text-sm text-ink">
                {formatAddress(claim.shippingAddress)}
              </pre>
              <div className="mt-4 flex flex-wrap gap-3">
                <form method="POST" action="/api/admin/approve-guide">
                  <input type="hidden" name="token" value={claim.approvalToken} />
                  <input type="hidden" name="action" value="approve" />
                  <button type="submit" className="btn-primary">
                    Approve and print
                  </button>
                </form>
                <form method="POST" action="/api/admin/approve-guide">
                  <input type="hidden" name="token" value={claim.approvalToken} />
                  <input type="hidden" name="action" value="reject" />
                  <button type="submit" className="btn-secondary">
                    Decline
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SchoolRequestsList rows={requests} paged={parsePageCursor(before) !== null} />

      <a href="/admin/campaign" className="btn-secondary mt-6 inline-flex min-h-11">Character Vote Campaign Results</a>

      <LibraryCodes
        books={libraryBookOptions()}
        rows={libraryCodeRows(grants, new Date())}
        olderCursor={olderCodesCursor(grants)}
        paged={parsePageCursor(codesBefore) !== null}
      />
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-paper px-4 py-12">
      <div className={`mx-auto w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-card sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-ink-soft/80">{publisherBrand.fullCredit}</p>
      </div>
    </main>
  );
}
