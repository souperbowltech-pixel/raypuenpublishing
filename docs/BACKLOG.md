# What is left to build

**Statuses in this file were verified against the code on 1 October 2026**, not copied from
`AUDIT.md`. Several rows in that table had drifted: things still marked OPEN were finished weeks
ago. Where the two disagree, this file is right and `AUDIT.md` is being corrected behind it.

## How to use this

- Read `docs/AGENT_RULES.md` first. It is the contract and it overrides anything here.
- **One item at a time.** Take the next item in section A, finish it completely, report it, and
  stop. Do not start a second one because the first turned out to be small.
- Do not pick anything from section B without asking. Those are deferred on purpose and the
  reasons are written down; "it was still open in the audit" is not a reason to reopen one.
- Do not commit or push. Leave the work in the working tree.

---

## A. Ready to work on now, in this order

Each item says what is wrong, why it matters, and where it lives. The order is by what a real
customer or a real child would feel first, not by what is easiest.

### 1. TEST-02 - two pieces of business logic have no tests at all

`gradeQuiz` and `resolveScoutAccess` are untested. `SPONSOR_TIERS` is already covered by
`lib/pricing.test.ts`. Do `resolveScoutAccess` first: it is an authorisation boundary.

### 2. TEST-01 - eleven of twelve API routes have no tests

Only `app/api/webhooks/stripe/route.test.ts` exists. The checkout routes come next, because they
are the ones that move money.

### 3. OPS-05 - some failures are only ever a console line

`lib/alerts.ts:14-15`, `lib/family-store.ts:153,165`. `lib/notifications.ts` and `lib/email.ts`
now exist, so these paths finally have somewhere real to report to.

---

## B. Deferred on purpose. Ask before touching.

- **SEC-03 - account enumeration on family registration.**
  `app/api/family/register/route.ts:38-46` tells a caller whether an address is already
  registered. This cannot honestly be closed by softening the message: the only real fix is to
  stop answering at registration time and confirm by email instead, which needs the email path
  finished first (tracker t32). Rewording alone would look like a fix and change nothing, which is
  worse than leaving it open and saying so.

- **SEC-06 - the demo profile is a public write target.**
  `lib/scout-access.ts:14-18`. Anyone can write to the shared demo record. This is a product
  decision rather than a bug: Ray demonstrates the site with `?demo=1` in front of people, and
  locking it down changes how he presents. Do not decide this in code.

- **SEC-02 - the rate limiter is per instance.**
  `lib/rate-limit.ts`. A shared limit needs Upstash Redis or Vercel KV, which is a paid dependency
  and the operator's call. The IP extraction reads `x-real-ip` and `x-forwarded-for`, which
  Vercel's own edge sets, so it is not freely spoofable on this deployment - but it is not a global
  limit either, and the file already admits that at the top.

---

## C. Blocked on Ray. Nothing to build until these arrive.

Full list and dates in `WAITING_ON_RAY.md`, one directory above the repository.

- The six interior pages Aymen never delivered.
- The finished Parent's Guide manuscript. Until it exists, `PARENTS_GUIDE_DIGITAL_LIVE` stays
  false, and the free printed Guide earned through the $10 Patrol is a promise with nothing behind
  it. `lib/pricing.ts:13-28` lists the three conditions that reopen it.
- Book 1 cover art. The site still renders `public/placeholders/cover.svg`.
- Sarah's 300 DPI re-export, and the Book 2 cover at print resolution - the current file is
  3112 by 2022, roughly 180 DPI across a wrap that needs about 5200 by 3300.
- The YouTube Unlisted link for the first video. Until then `/v1` honestly shows its waiting
  screen, and swapping the real one in is one database row and no deploy.
- The two-page character-story compilation PDF, for the free-download automation.
- The jingle, the print cost, and the hosting decision.
- Stripe going live, which is on hold by Ray's own decision.

---

## D. Blocked on the operator, not on code

- `ALERT_WEBHOOK_URL`, pointed at a Google Apps Script relay, so failures reach a mailbox instead
  of only Vercel's log.
- A Resend account, and DNS on `send.puenpublishing.com`: MX, TXT SPF, and TXT DKIM at
  `resend._domainkey.send`. **Never the root domain**, which carries the live `info@` mailbox.
- Vercel environment: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, and an `ADMIN_TOKEN` of at
  least 16 characters. Without `ADMIN_TOKEN`, both `/admin` and the detailed health answer stay
  shut.
- One $10 Patrol purchase in Stripe test mode, to prove the paid branch end to end.
- Delete the three dead `LULU_*` names from `.env.local`. Nothing reads them, `lib/lulu.ts` is
  gone, and their values are already on the rotation list in the handover report.
- The canonical-host redirect. `raypuenpublishing.vercel.app` answers 200 today instead of
  redirecting to `puenpublishing.com`, so the same pages are served on two hosts. The code no
  longer hands that address out, but the deployment still serves it.

---

## E. Already done. Do not redo these.

Verified in the code on 1 October 2026, whatever the status column in `AUDIT.md` still says:

| Item | What is true now |
|---|---|
| SEC-01 | All five checkout routes build their URLs from `getSiteOrigin()`; no `Origin` header fallback remains |
| SEC-05 | `lib/redact.ts` hides the address and the scout token before anything is logged or sent to a webhook |
| SEC-07 | `/api/health` gives a stranger the verdict and the check names only; the host, the key kind and database errors need the admin cookie or key |
| BUG-04 | Supabase has an 8s deadline, MailerLite 6s, Stripe 8s with one retry |
| BUG-08 | One `EMAIL_REGEX` and one `isEmailAddress`, exported from `lib/family.ts` |
| FE-05 | `lib/fulfillment.ts` owns the print flag and `dispatchPrintOrder`; "Dispatched" renders only from an order reference the printer returned |
| FE-06 | The Lightbox moves focus in on open, restores it on close, and cycles Tab inside the dialog |
| FE-07 | The storefront no longer says card handling arrives in Milestone 2 |
| OPS-01 | `.github/workflows/ci.yml` is committed |
| OPS-02 | The README no longer describes a stub-checkout milestone |
| OPS-03 | The demo token is written down only in `lib/family.ts` |
| OPS-04 | Vendor confirmed as IngramSpark by Ray's own directive; no mismatch left in the repository |
| Links | No file in `app`, `components` or `lib` hands out the hosting platform's host name |
| PERF-01 | Fallback stores document per-instance divergence on serverless; mirror write skipped on DB success path and retained on error/dropped-column fallback paths (pinned in `lib/fallback-stores.test.ts`) |
| API-03 | Wholesale checkout enforces shipping address server-side for Premium tiers (verified 2026-10-01: guard was already present in `app/api/checkout/wholesale/route.ts:56-70`; pinned by `app/api/checkout/wholesale/route.test.ts`) |
| BUG-05 | Sponsor-confirm fallback records order, marks fulfillment, and syncs MailerLite (verified 2026-10-01: implemented in commit `7dad223`; pinned by `app/api/checkout/sponsor/confirm/route.test.ts`) |
| SEC-04 | Retail quantity capped at 1..50, invalid values rejected with 400 (verified 2026-10-01: implemented in commit `7dad223`; pinned by `app/api/checkout/retail/route.test.ts`) |
| SEC-08 | Wholesale metadata length capped for institution name, contact, phone, and shipping address fields (verified 2026-10-01: institution/contact/phone capped in commit `7dad223`; shipping address capped in `app/api/checkout/wholesale/route.ts`; pinned by `app/api/checkout/wholesale/route.test.ts`) |

`lib/copy-hygiene.test.ts` fails if OPS-03, FE-07 or the link rule is ever undone.
