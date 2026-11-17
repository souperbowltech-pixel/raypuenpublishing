import { SCHOOL_REQUESTS_PAGE_SIZE, pageCursor, type SchoolRequestRow } from "@/lib/school-request-store";

/** Server time is UTC, so the time is labelled rather than guessed into Ray's zone. */
const WHEN = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatWhen(createdAt: string): string {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? createdAt : `${WHEN.format(date)} UTC`;
}

/**
 * The requests leaders send from /neighborhood, newest first, on /admin.
 *
 * The email to Ray is a courtesy; this list is where every saved request can be
 * read, so `rows === null` (the table could not be read) says so plainly
 * instead of looking like an empty inbox.
 */
export function SchoolRequestsList({ rows, paged }: { rows: SchoolRequestRow[] | null; paged: boolean }) {
  return (
    <section aria-labelledby="school-requests" className="mt-12">
      <h2 id="school-requests" className="font-display text-2xl font-bold text-ink">
        Requests from leaders
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Sent from the Neighborhood Chronicles sample page. Newest first.
      </p>

      {rows === null ? (
        <p role="alert" className="mt-6 rounded-xl border border-clay/30 bg-clay/10 p-5 font-semibold text-clay-dark">
          The requests could not be loaded just now. Please reload the page in a minute. Nothing has been lost.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-ink/5 p-5 text-ink-soft">
          {paged ? "There are no older requests." : "No requests yet. Each one appears here the moment a leader sends it."}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-ink/10 bg-paper-deep p-5">
              <p className="font-display text-lg font-bold text-ink">{row.school}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {row.name}, {row.role}
              </p>
              <p className="text-sm text-ink-soft">{row.location}</p>
              <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm text-ink sm:grid-cols-[auto_1fr]">
                <dt className="font-bold">Email</dt>
                <dd>
                  {/* Encoded, so an address carrying "?cc=" cannot add recipients to Ray's reply; "@" stays readable for every mail app. */}
                  <a href={`mailto:${encodeURIComponent(row.email).replace(/%40/g, "@")}`} className="inline-flex min-h-11 items-center break-all underline">
                    {row.email}
                  </a>
                </dd>
                {row.phone && (
                  <>
                    <dt className="font-bold">Phone</dt>
                    <dd>{row.phone}</dd>
                  </>
                )}
                {row.copies !== null && (
                  <>
                    <dt className="font-bold">Copies</dt>
                    <dd>{row.copies}</dd>
                  </>
                )}
                <dt className="font-bold">Sent</dt>
                <dd>{formatWhen(row.createdAt)}</dd>
              </dl>
              {row.message && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-paper p-3 text-sm text-ink">{row.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {(paged || (rows !== null && rows.length === SCHOOL_REQUESTS_PAGE_SIZE)) && (
        <nav aria-label="More requests" className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
          {paged && (
            <a href="/admin#school-requests" className="inline-flex min-h-11 items-center underline">
              Back to the newest
            </a>
          )}
          {rows !== null && rows.length === SCHOOL_REQUESTS_PAGE_SIZE && (
            <a
              href={`/admin?before=${encodeURIComponent(pageCursor(rows[rows.length - 1]))}#school-requests`}
              className="inline-flex min-h-11 items-center underline"
            >
              Older requests
            </a>
          )}
        </nav>
      )}
    </section>
  );
}
