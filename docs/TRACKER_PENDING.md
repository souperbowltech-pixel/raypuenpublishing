# Tracker changes waiting to be applied

The task board lives at <https://claude.ai/artifact/LoTZHH98UCqWa9DoE7swi7> and only a Claude
session can republish it. Any other agent writes what changed here instead, and the next Claude
session applies these entries to the board and deletes them from this file.

Keep each entry short and factual: the task id, the new status or check, and the evidence.

Format:

```
- [ ] tNN — <what changed> — <evidence: commit, live URL, test output>
```

---

## Pending

### 30 Sept — A2 done, A5 started

- [x] **A2 — Ray's admin view** (`c830eeb`). `/admin` lists every pending free-Guide claim; shut by
  default (no `ADMIN_TOKEN`, no admin view), key exchanged for an httpOnly cookie through a form POST
  so it never sits in a URL, compared in constant time, stored as a hash.
  **It also fixed a real hazard:** approval used to happen on **GET**, so any mail scanner, antivirus
  link-checker or chat preview could approve a claim before Ray saw it. GET now only shows a
  confirmation page; the decision needs the POST. Verified live.
- [x] **A5 / SEC-05 — personal data out of logs and alerts** (`8c1152e`). Seven alert payloads and
  two log lines in the Stripe webhook carried a customer's address or a scout token, and alerts are
  POSTed to a chat webhook where they would sit forever. Both are redacted now. The order row and
  the MailerLite subscriber deliberately keep the real values, and a test holds that line.
- [x] **A5 / BUG-04 — deadlines on the database and MailerLite** (`9f78017`). Neither had one, and a
  call without a deadline hangs rather than fails: a stalled MailerLite would hold a paid webhook
  open until the platform killed it, with every remaining step unrun. 8s for the database at the one
  fetch every query passes through, 6s for MailerLite.
  *Worth remembering:* the first version of those tests read the source for strings and passed with
  the timeout deleted. They now stub fetch and prove the abort fires.

**192 tests pass.** Still open in A5: BUG-08 (the email regex written three times), SEC-03 (account
enumeration on registration), SEC-06 (the demo profile is a public write target), SEC-07 (health
discloses infrastructure detail), FE-05, FE-06 (lightbox focus), PERF-01, OPS-04.
Then A6, the Oct 4 delivery.

### 29-30 Sept — A1, A4 and A3 done

- [x] **A1 — email exists** (`148d7a1`, `f395eb0`). `lib/email.ts` speaks to Resend directly, with an
  8s deadline, and reports `sent: true` only against a real message id. `lib/notifications.ts` adds
  the two messages that were missing: the Patrol receipt (hub link + three gift codes, sent from the
  webhook) and **Ray's free-guide approval**, which previously reached nobody at all. Both are inert
  until `RESEND_API_KEY` and `EMAIL_FROM` are set in Vercel — **still the user's step**, along with
  the Resend account and the DNS records on `send.puenpublishing.com` (never the root domain, which
  carries the info@ mailbox).
  Two things fell out of writing it: Resend echoes the API key inside a 401 body, so provider error
  text is now scrubbed before it can reach a log; and the webhook was logging the patrol token,
  which is enough on its own to open somebody's Patrol (AUDIT SEC-05).
- [x] **A4 — a digital Guide is not a parcel** (`04f00ab`). `guide_digital` fell through to the retail
  branch and promised printing and 2-3 day dispatch. It now has its own wording, and the promise of
  an emailed download sits inside the `PARENTS_GUIDE_DIGITAL_LIVE` branch so the two cannot drift.
- [x] **A3 — the Stripe webhook is tested** (`8828692`), closing the audit's last CRITICAL gap
  (TEST-01). 14 tests; all passed first time, so each rule was then deliberately broken and every
  mutation turned the suite red. `vitest.config.ts` now picks up `app/**/*.test.ts`.

**165 tests pass.** Remaining from the A-list: A2 (Ray's admin view), A5 (the rest of the audit),
A6 (the Oct 4 delivery).

### 29 Sept — done today

- [x] **Book 2 cover is live** (t19). Sarah's wrap arrived; the front was cropped out and is now shown
  on the dashboard, in the continuation banner and in the progress panel. 721x946, 206 KB, commit
  `b3e67dd`, verified live. **Print is separate**: her file is ~180 DPI across the wrap where
  IngramSpark needs 300, and a re-export has been requested (`WAITING_ON_RAY.md` R9).
- [x] **The $10 Patrol can now reach its buyer** (commit `19f79be`). It used to create the gift codes
  and write the token only to the server log, while telling the buyer a digital product would be
  "dispatched within 2-3 business days". The success page now hands over the Patrol link, looked up
  from the Stripe session, and says "still being set up" rather than claiming failure when the
  webhook has not landed. 9 tests, 3 mutations caught.
  **Still unverified:** a real Stripe test payment has not been run against it. The branch is proven
  by tests, not by a live purchase. The user can confirm with a $10 test-mode checkout.
- [x] **The digital Guide is closed** (commit `0b559bd`) until the PDF exists, an email path exists,
  and the success page has a `guide_digital` branch. Refused server-side, not just hidden.

### Known weakness worth remembering

The local dev store is one JSON file (`data/patrols.json`) and vitest runs test **files** in
parallel, so two files that both create patrols will clobber each other. All store-touching patrol
tests therefore live in `lib/patrol.test.ts`. Adding them elsewhere reintroduces the flake.


### Found on 28 Sept while verifying the 26-27 Sept work (add these to the board)

- [ ] **NEW / CRITICAL — the Parent's Guide is sold but cannot be delivered.** `/guide` is live and
  takes $29.97. The page promises "Instant Master PDF Download", a "Full 34-page companion PDF
  curriculum" and an "Instant download link delivered immediately". There is **no PDF anywhere in
  the repo** (Ray has never sent it — `WAITING_ON_RAY.md` R7), **nothing in the codebase sends
  email** (no Resend, no nodemailer, no sendEmail), and `app/checkout/success/page.tsx` has no
  branch for a guide order, so the buyer is told "Dispatched directly to your address within 2-3
  business days" — for a digital product that does not exist. This is the same class of fault as
  the CRITICAL FE-01 that was fixed in September. Harmless only because Stripe is still in test
  mode. **Must be gated or reworded before Stripe goes live.**
- [ ] **NEW / HIGH — Ray never receives the free-guide approval.** `lib/patrol-store.ts:374` puts the
  one-click approval URL into `alertFailure(...)`, which writes to the server log and POSTs to
  `ALERT_WEBHOOK_URL` — and that variable is still unset (t07). So at 3/3 the claim is recorded and
  nobody is told. The gate exists; the delivery does not. Do not describe it as an "email approval
  gate" to the client until something actually sends it.
- [ ] **NEW / LOW — storefront page count is stale.** `lib/book.ts` still says `pageCount: 32`; the
  file we hold is 33 pages and Ray's target is 34. The dimensions were corrected to 8.5 x 11 but the
  count was not.
- [x] **Health now covers the new schema** (commits `5040a18`, `f958d99`). It previously probed only
  the pre-referral tables, so "health is green" proved nothing about the 26-27 Sept work. Now 12
  checks, all passing live — which is what confirms **both new migrations really are applied in
  production**: `scoutReferralColumn`, `patrolLeadersTable`, `patrolGiftsTable`, `guideApprovalsTable`.


- [ ] **t16** — Real friend tracking (2 of 3 friends colour Page 1 → 300 pts & Book 2 unlock) — Tested (migration `20260926_add_scout_referrals.sql`, 5 new tests in `lib/referrals.test.ts`, commit `c91bdd3`).
- [ ] **t12–t15** — Parent's Guide & Chief Scout Patrol funnel ($29.97 digital edition, $10.00 bundle with 3 gift QRs, registration gift redemption, Ray's one-click approval gate) — Tested (migration `20260926_create_patrol_and_guides.sql`, 5 tests in `lib/patrol.test.ts`, commit `d37947d`).
- [ ] **t11** — Chief Explorer naming consistency across banners, profiles, gamification strings, and tests — Tested (helpers in `lib/gamification.ts`, `ScoreGate.tsx`, `BookUnlockCard.tsx`, `family.test.ts`).
- [ ] **t35** — GitHub Actions CI workflow (`.github/workflows/ci.yml`) running `npm ci`, `lint`, `typecheck`, `test`, `build` — Tested.
- [ ] **t37** — Server-side shipping address validation for wholesale Tiers 2 & 3 in `app/api/checkout/wholesale/route.ts` — Tested.
- [ ] **SEC-01** — Origin header enforcement for Stripe returns via `lib/site.ts:getSiteOrigin()` across all checkout routes — Tested.
- [ ] **SEC-02** — Rate limiter Vercel edge IP spoofing protection via `x-real-ip` priority in `lib/rate-limit.ts` — Tested.
- [ ] **BUG-05** — Order recording and MailerLite subscriber sync in sponsor confirmation fallback route (`/api/checkout/sponsor/confirm`) — Tested.
- [ ] **SEC-04 / SEC-08** — Retail quantity bounds validation (1..50) and wholesale metadata length limits — Tested.
- [ ] **OPS-02** — Modern production Next.js 14 / Supabase architecture documentation in `README.md` — Tested.
- [ ] **Book Trim Size** — Storefront dimensions updated to 8.5" × 11" (US Letter, softcover) per Ray's confirmation — Tested (`lib/book.test.ts`).


## Board state at the last sync

- **t46** five printed video pages — Tested. Commits `a63fb2f`, `32b7b2e`, `a298ebd`; swap proved
  live on 26 Sept with no deploy.
- **t47** videos migration — Tested. `/api/health` reports `videosTable` passing.
- **t49** granddaughters' credit line — Tested. Commit `bfb2af2`.
- **t50** which pages carry the video codes — **blocked on Ray**, message sent 26 Sept.
- **t25** domain on Vercel — Tested.
- **t36** Stripe "email finalized invoices" — to do, deliberately deferred to Stripe go-live.
- **t07** `ALERT_WEBHOOK_URL` — to do; the Google Apps Script relay is written and with the user.
- Next largest piece of work: **t16**, real friend tracking. Nothing blocks it.
