# Character vote campaign: specification and QA contract

Status: local implementation in progress. No production deployment authorized.

## Scope and decisions

The parent watches the existing NC Welcome Video, chooses one of five characters,
and requests a free Starter Kit. Watching is optional; blocked video must not block
the form. Collect adult details only. One immutable vote per normalized email per
campaign, not one verified family. A submission UUID makes network retries safe.
Reusing that UUID for different input is a conflict. A different UUID for an existing
email receives a neutral response with no private receipt or personal details.

Optional marketing and text permissions are separate, unchecked choices. Neither
enrolls someone in an unbuilt marketing sequence or sends an SMS. Adult confirmation
is mandatory. Do not collect a child's name, age, address or telephone number.

The receipt is an expiring signed capability carried in a URL fragment, never a
query parameter. It authorizes only this campaign's kit and one reservation. Storage
is private. The kit URL lasts five minutes; the receipt lasts 30 days. Reservations
are expressions of interest, never payments or delivery guarantees. The server
uses existing Stripe configuration to select reservation or NC order link.

Keep the first successful vote and source. Recognized sources: fiesta, church,
school, melissa-data and dm. Everything else is direct. No arbitrary tracking
strings, redirect URLs, or email addresses are retained as attribution.

Use a durable transactional outbox. Save the vote and its kit email together; save
the reservation and owner notification together. A leased worker processes a
bounded batch with backoff and provider idempotency. Provider acceptance and inbox
delivery differ. A crash after provider acceptance but before database acknowledgement
can still produce a duplicate after the provider's 24-hour deduplication window.
Do not promise exactly-once email delivery. Sent-state and an atomic lease reduce
duplicates and retain failed work for review.

Follow-up sales sequences, SMS sending, donations, distribution commissions and
automatic IngramSpark fulfilment are outside this implementation.

## Component mini-specs

1. Domain: unknown JSON in; bounded normalized vote/reservation or field error out.
   Pure functions, no network. Reject wrong types, invalid UUIDs, control characters,
   oversized input and missing consent. Central seasonal cutoff in Pacific time.
2. Persistence: validated input in; saved/replay/duplicate/conflict/unavailable out.
   Supabase transaction RPC owns uniqueness, vote plus outbox and reservation plus
   outbox. Default-deny RLS; only service role executes functions. Indexed newest-first
   pagination, SQL aggregates, bounded admin exports. Missing DB never falls back
   to local memory. Start at 1,000 names, retain bounded operations at 100,000.
3. Delivery: signed receipt and existing private storage. Server-owned bucket/path,
   no visitor-selected file. Durable leased outbox, bounded worker deadline, no
   contact details or capabilities in logs. External calls use existing timeouts.
4. Public routes: JSON-only, same-origin checks, byte-bounded bodies, rate limiting,
   truthful status codes, no-store responses. Save before email or granting access.
5. UI: existing brand, keyboard radio group, explicit adult form, labeled optional
   fields, inline errors and busy/retry states. Preserve input on error. Receipt
   page handles reload, expired links, file outage and actual email send state.
6. Admin: authenticate before reading; campaign counts, leads, reservations, delivery
   status, bounded CSV and protected retry. Escape HTML and neutralize spreadsheet
   formulas. A separate campaign page reuses the existing admin cookie.

## Acceptance cases

| ID | Use case | Required result |
| --- | --- | --- |
| V01 | Each of five characters, valid parent | One vote, matching thank-you, one kit email |
| V02 | Null/array, malformed JSON, huge body, invalid types/UUID/email/name | Reject before persistence/email |
| V03 | Optional answer/phone absent | Stored null; no invented consent |
| V04 | Phone without explicit permission; unchecked marketing | Phone permission enforced; no silent enrollment |
| V05 | Double click, lost response, concurrent retry | Immutable row and one outbox item; conflict on changed retry |
| V06 | Existing email with new request ID | Neutral response; no existing data or receipt exposed |
| V07 | Known, unknown and malicious source tags | Canonical bounded source, no redirect or PII |
| V08 | Missing DB/RPC, timeout or empty response | Unavailable; no fabricated success |
| V09 | Failure midway through transaction | No orphan row/outbox or partial reservation |
| D01 | Valid receipt | Five-minute URL for fixed private kit only |
| D02 | Missing/tampered/expired/revoked receipt or unknown row | Generic denial; no personal data |
| D03 | Missing file/storage outage | Honest unavailable state and retry |
| E01 | Provider accepts and returns ID | Save sent status only after acceptance |
| E02 | Provider timeout/error; overlapping workers; worker crash | Lease, backoff, retained error state, stable idempotency key |
| R01 | Reservation while Stripe test mode | Save once, queue owner email, no payment language |
| R02 | Forged receipt, invalid quantity or duplicate | Reject forged input; original reservation preserved |
| R03 | Stripe goes live | Server exposes existing NC checkout instead |
| A01 | Anonymous statistics/list/CSV/retry request | Denied before accessing data |
| A02 | HTML/CRLF/formula in contact/answer | Safe React/plain-text output and formula-safe CSV |
| A03 | Large list, equal timestamps, concurrent inserts | Indexed cursor, bounded query, SQL totals |
| S01 | Before/at/after seasonal cutoff in other timezones | Christmas copy ends at the configured Pacific cutoff |
| U01 | Phone widths, keyboard, slow/error/retry/back | Usable controls and accessible state; input retained |
| U02 | Blocked video, missing artwork, reduced motion | Parent form stays usable without false visual claims |

## Independent QA role

The campaign QA agent is read-only and independent of the implementation. It reads
actual changes and callers, runs relevant tests, challenges missing/fake coverage,
and reports file:line findings as CRITICAL, IMPORTANT or MINOR. The implementer fixes
confirmed findings and returns for review. A passing mock is not SQL deployment proof.

Frameworks: VF-ART-01, preserve existing brand and use supplied artwork only;
VF-THANKS-01, show truthful confirmation and a clear recovery path. No decorative
animation is required to finish the parent's task. Full canonical analyses and
timestamped evidence were read before applying these principles.

## Production gates

- Static checks and all existing/new automated tests pass without weakened tests.
- Mutation checks prove that critical validation, token, route and authorization
  branches fail when deliberately broken; restore and re-run afterward.
- Execute migration and SQL rollback assertions in a separate staging database.
  Independently exercise two concurrent submissions/workers and verify anon denial.
- Upload the final Starter Kit to private storage; validate complete PDF and signed URL.
- Configure campaign secret and scheduled-worker secret in hosting, not files.
- Verify a real email to an approved test inbox, retry and owner notice in staging.
- Phone rendering, keyboard journey, video failure, network failure and receipt reload.
- Final approved character messages/art/optional question and kit page count checked.
- Deploy only with operator instruction, then verify campaign readiness and rollback.

Passing local tests cannot guarantee zero production defects or prove a migration,
real email delivery, cron scheduling or phone layout that has not been exercised.
