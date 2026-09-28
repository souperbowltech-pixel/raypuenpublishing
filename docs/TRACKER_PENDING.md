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
