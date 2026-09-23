# FIX PLAN — how each AUDIT.md finding gets solved

_Written 2026-09-23, before implementation. Companion to `AUDIT.md`._

For every issue this document answers four questions:
1. **Fix** — what we actually do.
2. **Why this and not something else** — the alternatives considered and why they lose.
3. **What could break** — the new failure modes this fix introduces (this is the part that
   usually bites; it is written before the code, not after).
4. **How we prove it** — what has to pass before the fix counts as done.

Order follows `AUDIT.md` section 6: CRITICAL first, and nothing in a later phase starts until the
phase above it is green.

---

## ⚠️ Decisions needed before some fixes can be implemented

| # | Question | Blocks | Default if no answer |
|---|---|---|---|
| D1 | **Upgrade Next.js 14.2.15 → 14.2.35?** `npm audit` reports 1 CRITICAL + 1 HIGH advisory, all inside the bundled `next`/`postcss`. 14.2.35 is a patch release on the same major, so no breaking changes are expected. `CLAUDE.md` §11 forbids upgrading a dependency without asking. | the `npm audit` findings | Do not upgrade; leave as a documented open risk |
| D2 | **Should wholesale buyers actually get an invoice**, or is corrected wording enough? Enabling Stripe `invoice_creation` changes what real customers receive. | API-02's permanent fix | Fix the wording only (zero-risk), flag invoicing as a product decision |
| D3 | **Delete the dead per-unit wholesale pricing code** (`PricingCalculator`, `calculateWholesalePrice`, `initiateWholesaleCheckout`), or keep it for a future pricing mode? | FE-03, FE-04 | Keep the code, fix the misleading README line only — deleting is irreversible-ish and the tests around it are the project's best test suite |
| D4 | **Is the missing real friend-referral flow (BUG-06) planned work or a bug?** | BUG-06 | Treat as planned work; document it, do not build it in this pass |

Everything else below is safe to implement without new input.

---

# PHASE 1 — CRITICAL

## BUG-01 — `updateScoutAsync` reports success even when the database write fails

**Fix.** Change the function's contract from "always returns the state" to "returns the state *and*
whether it was actually persisted":

```ts
export type ScoutWriteResult = {
  state: PersistentScoutState;
  persisted: boolean;        // did the write reach durable storage?
  error?: string;            // why not, when persisted === false
};
```

`persisted` is computed honestly per environment:
- Supabase configured → `true` only if **both** upserts returned no error.
- Supabase not configured **and not production** → `true` (the local JSON store is the intended
  dev backend).
- Supabase not configured **and production** → `false` (this is the exact misconfiguration that
  silently broke the live site on Sept 14).

Then each of the three callers stops assuming success:
- **Stripe webhook** — on `persisted === false`, set `retryNeeded = true` and **do not** call
  `markOrder(..., "fulfilled")`. Stripe then retries the event, which is safe because every step
  is idempotent. The order row keeps `fulfillment_status: "pending"` with `last_error` set, so a
  human can see exactly which paid orders are unfinished.
- **`/api/scout/update`** — return HTTP 503 with `{ error, saved: false }` instead of
  `{ success: true }`. The child's browser keeps its optimistic state and shows a "couldn't save"
  banner (see FE-02) rather than silently losing the work.
- **`/api/checkout/sponsor/confirm`** — the sponsor has *already paid*, so telling them the
  payment failed would be a lie in the other direction. Return
  `{ success: true, paid: true, unlockPending: true }`, fire `alertFailure`, and show
  "payment received — we're finishing the unlock" in the UI.

**Why this and not something else.**
- *Throwing on failure* would be simpler, but the webhook's existing `try/catch` would swallow it
  into a generic 500 and we would lose the distinction between "Stripe sent us garbage" and "our
  database is down" — which is precisely the signal ops needs.
- *Returning `null`* forces every caller to re-fetch the state to show anything at all, which
  turns one failure into two round-trips and breaks the optimistic-UI story.
- A result object makes the failure **impossible to ignore silently**, because TypeScript forces
  every existing call site to be revisited when the type changes. That compiler pressure is the
  real value here.

**What could break.**
1. *Stripe retry storms.* If Supabase is down for an hour, every sponsorship webhook now returns
   500 and Stripe retries with backoff for up to ~3 days. That is the correct behaviour (the
   alternative is losing the order), but it will generate repeated alerts. Mitigation:
   `reportDbProblem`/`alertFailure` already de-duplicates per problem-kind per instance.
2. *Legitimate "no database in local dev" now looks like a failure.* Guarded explicitly by the
   `isProduction` branch above — local dev keeps returning `persisted: true`.
3. *A child mid-session suddenly sees errors where before it silently "worked".* This is the point
   of the fix, but it must not look like their progress vanished — hence FE-02 ships alongside it,
   not after it.
4. *The second (`friends_completed`/`book3_sponsored`) upsert is "best-effort" by design*, for
   databases where the migration has not been applied. If we now treat its failure as
   `persisted: false`, a project on an old schema would hard-fail every write. Mitigation: track
   the two upserts separately — the primary upsert failing means `persisted: false`; the extra
   columns failing is reported but only downgrades `persisted` when the caller actually changed
   one of those fields (i.e. a sponsorship unlock), which is checked from the `partial` keys.

**How we prove it.** New unit tests with a fake Supabase client covering: primary upsert fails →
`persisted: false`; extra upsert fails while sponsoring → `persisted: false`; extra upsert fails on
an unrelated field → `persisted: true`; no Supabase in dev → `persisted: true`; no Supabase in
production → `persisted: false`. Plus a webhook test asserting a failed write returns 500 and does
**not** mark the order fulfilled.

---

## FE-01 — Checkout success page confirms payment that may never have happened

**Fix.** Make the page render one of three honest states, decided by what Stripe actually says:

| Condition | What the customer sees |
|---|---|
| `payment_status === "paid"` (or `"no_payment_required"`) | The current success content |
| Session retrieved but not paid | "We haven't received payment for this order yet" + link back to the store |
| No `session_id`, or the Stripe lookup threw | Neutral: "We couldn't confirm this order automatically — if you were charged, your receipt from Stripe is confirmation and our team will follow up." No fulfilment promises. |

The fulfilment bullet list ("printed on premium paper", "dispatched within 2-3 business days")
renders **only** in the paid state.

**Why this and not something else.**
- *Trusting the `session_id` in the URL* is what the page does today and is exactly the bug.
- *Redirecting unpaid visitors to the homepage* hides a real situation from someone who may
  genuinely have been charged and hit a race with Stripe's redirect — a blank redirect would be
  scarier than a clear message.
- Three states keep the "we don't know" case distinct from the "you definitely didn't pay" case.
  Collapsing them would produce a false negative for a paying customer, which is the same class of
  dishonesty as the original bug, just inverted.

**What could break.**
1. *`payment_status` for async payment methods.* Bank debits/vouchers settle later and report
   `unpaid` with `status: "complete"`. This project takes card payments only today, so `paid` is
   correct — but the neutral (not the "you didn't pay") wording is what such a customer would see,
   which is why the third state must not accuse anyone of not paying.
2. *100%-discount / zero-value sessions* report `no_payment_required`, which is why it is treated
   as paid.
3. *Stripe being slow now changes what the customer sees*, not just how fast they see it —
   handled by API-01's timeout landing in the same change, so a slow Stripe produces the neutral
   state quickly rather than a hung page.
4. *SEO/analytics that counted "success page views" as conversions* would now over-count the
   neutral state. Nothing in this repo does that today (checked: no analytics script).

**How we prove it.** Unit tests over the extracted decision function (`paid` / `unpaid` /
`unknown`) for: missing session id, Stripe throwing, `payment_status` each of
`paid`/`unpaid`/`no_payment_required`. Then a manual pass in the browser against a real test-mode
session and a junk `session_id`.

---

## TEST-01 / TEST-02 — No tests for the API routes or the business logic

**Fix.** Add a real test suite in three layers, and widen `vitest.config.ts` so tests outside
`lib/` are picked up:

1. **Pure logic (highest value per hour).** Export and test `deriveScoutFields` — the single
   function deciding `hasPassedQuiz`, `book2Unlocked`, `referralScore`, `status`. Cover the
   thresholds either side of the boundary (399/400/401 quiz points, 1/2/3 friends, 699/700/701
   total), plus clamping of out-of-range and non-numeric input. Same treatment for
   `resolveScoutAccess` (the authorisation boundary) and `gradeQuiz`.
2. **Money paths.** Assert every `SPONSOR_TIERS` entry's `flatPrice`, `booksSponsored`,
   `requiresShipping` and `isPremiumSponsor`, so a typo in a real charged amount fails the build.
3. **Route-level behaviour** for the Stripe webhook: unsigned request rejected; a
   `checkout.session.completed` delivered twice produces exactly one order row; a failed scout
   write returns 500 and leaves the order unfulfilled (this is BUG-01's regression test).

**Why this and not something else.**
- *Starting with end-to-end tests* would need a live Supabase and Stripe and would be slow and
  flaky; the pure functions carry most of the risk and cost minutes to cover.
- *Mocking Supabase inside `lib/scout-store.ts`* to test `updateScoutAsync` risks the
  `CLAUDE.md` §5 trap of "mocking the exact thing being tested". We avoid it by injecting a fake
  client at the module boundary and asserting on **observable outcomes** (what got written, what
  the result object says) rather than on "was this mock called".

**What could break.**
1. *Widening the vitest `include` may sweep up `.next/` build output or `node_modules`* and
   explode the run. The include pattern stays explicit (`lib/**` plus `app/**/__tests__/**`) and
   `.next` is excluded.
2. *Testing a Next.js route handler requires a `NextRequest`*, which needs a real `Request`
   polyfill. Node 18+ has it natively — confirmed this project targets Node 18.18+.
3. *A test suite that needs environment variables* (e.g. `STRIPE_WEBHOOK_SECRET`) will fail on a
   clean machine and in CI. Tests set their own env inside the test file rather than relying on
   `.env.local`.
4. *False confidence*: a webhook test that stubs signature verification proves nothing. We
   generate a genuinely valid signature with Stripe's own `stripe.webhooks.generateTestHeaderString`
   so the real verification code runs.

**How we prove it.** `npm test` goes from 28 tests to a suite that covers every threshold in the
reward logic, both auth paths, all three sponsor tiers, and the webhook's idempotency. Every new
test must fail when the corresponding line of production code is reverted — a test that passes
against broken code is worse than no test.

---

# PHASE 2 — HIGH

## BUG-02 — Lost updates from the read-modify-write race

**Fix.** Optimistic concurrency on the existing `updated_at` column:
1. `getOrCreateScoutAsync` gives us `current`, including its `updatedAt`.
2. Write with `.update(...).eq('token', t).eq('updated_at', current.updatedAt).select()`.
3. Zero rows returned means somebody else wrote in between → re-read, re-merge the caller's
   `partial` onto the *fresh* state, try again (max 3 attempts).
4. After 3 collisions, give up and return `persisted: false` — which, thanks to BUG-01, is now a
   visible failure rather than silent data loss.

Client side, `handleTogglePage` debounces rapid clicks and serialises its saves, so the common
case never reaches step 3.

**Why this and not something else.**
- *A Postgres function / transaction doing the merge server-side* is the textbook answer and
  genuinely better, but it needs a migration applied through the Supabase dashboard before the
  code can ship. Optimistic concurrency needs no schema change and no deploy coordination, and it
  can be swapped for an RPC later without changing any caller.
- *A `version` integer column* is cleaner than comparing timestamps, but also needs that
  migration.
- *Locking per token in application memory* does nothing across serverless instances — the exact
  mistake `lib/rate-limit.ts` already documents about itself.

**What could break.**
1. **Timestamp precision mismatch — the real trap here.** Postgres `timestamptz` keeps
   microseconds; our ISO string carries milliseconds. Rows we wrote ourselves round-trip exactly
   (we always supply the value), but a row created by the schema default `now()` carries
   microseconds that our millisecond string will never match, so the first update after row
   creation would always "collide". The retry loop absorbs this (re-read gets the DB's own value),
   and from the first successful write onward every value is ours. Without the retry this fix
   would deadlock the very first save for every new child — which is why the retry is not
   optional.
2. *Retry storm under heavy contention* — capped at 3 attempts, then an honest failure.
3. *`update` instead of `upsert` requires the row to exist.* `getOrCreateScoutAsync` runs first
   and creates it, so by step 2 it does. If a row were deleted between the two calls, the update
   matches nothing and, after retries, reports failure instead of silently recreating a blank
   profile — the safer outcome.
4. *Debouncing can lose the final click* if the page unmounts mid-debounce. The debounce flushes
   on unmount and on `visibilitychange`.

**How we prove it.** A test driving two interleaved updates against a fake client that simulates a
competing write, asserting neither change is lost. Manually: click several stickers rapidly, reload,
confirm all are still there.

---

## API-01 / BUG-04 — No timeout on any external call

**Fix.** Give every outbound call a deadline:
- Stripe: `new Stripe(key, { timeout: 8000, maxNetworkRetries: 1 })`.
- MailerLite: `AbortSignal.timeout(5000)` on the `fetch`.
- Supabase: wrap the existing `noStoreFetch` with an 8s `AbortSignal.timeout`.
- The success page stops doing MailerLite work in the render path entirely (see BUG-03).

**Why this and not something else.** A platform-level function timeout is not a substitute: it
kills the request without letting us return a useful message, and it bills the full duration.
Per-call deadlines let each failure become a specific, honest response.

**What could break.**
1. *A too-aggressive timeout turns a slow-but-successful payment into a visible failure.* 8s is
   comfortably above Stripe's normal latency; the value is a named constant so it can be tuned.
2. *`AbortSignal.timeout` needs Node 17.3+* — fine on Node 18.18+, which this project already
   requires.
3. *Aborting a Supabase write mid-flight does not roll it back* — the row may still be written
   while we report failure. With BUG-01 in place this surfaces as "not saved" when it actually
   saved, which is the safe direction (a retry is idempotent) but means "persisted: false" must be
   read as "not confirmed", not "definitely not written". Documented in the code comment.

**How we prove it.** A test with a deliberately hanging fake fetch asserting the call rejects at
the deadline rather than hanging.

---

## API-02 — Wholesale page claims an invoice was sent

**Fix (default, pending D2).** Replace the sentence with what the system actually does: the buyer
gets Stripe's own payment receipt and a human follow-up. No code path claims work that does not
happen.

**Why this and not something else.** Enabling Stripe's `invoice_creation` would make the claim
true, but it changes what every real institutional customer receives and how Ray's Stripe account
issues documents — a business decision, not a code cleanup. Honest wording is correct immediately
and stays correct if invoicing is added later.

**What could break.** Institutions that need an invoice for reimbursement now learn that earlier,
which may generate support email — a real cost, but far smaller than silently promising paperwork
that never arrives.

**How we prove it.** Copy diff review; no logic involved.

---

## FE-02 — Dashboard silently shows zeroed progress when a fetch fails

**Fix.**
1. Check `res.ok`. Keep the 401 → `/start` redirect; on any other non-OK status, set an error
   state and render a "We couldn't load your progress — Try again" panel **instead of** the
   zeroed dashboard.
2. Never fall through to `useState` defaults on failure — defaults mean "new scout", and we must
   only show that when the server actually said so.
3. On a failed save, roll the optimistic sticker toggle back and show an inline "not saved" note,
   using the `saved: false` signal that BUG-01 now provides.

**Why this and not something else.** Auto-retrying silently would hide a systemic outage and make
the race in BUG-02 worse. An explicit, user-triggered retry keeps the child in control and makes
the failure visible to the parent, which is what a rewards product needs.

**What could break.**
1. *Confusing a genuinely new child with an error.* A brand-new scout gets HTTP 200 with a fresh
   profile, so the empty state is still driven by the server, never by a failure.
2. *Rollback flicker* — a sticker briefly appearing then un-appearing looks like a bug to a child.
   The toggle shows a pending state while saving and only settles once the server confirms.
3. *Offline/flaky mobile makes the error panel appear often.* Acceptable and honest; the retry is
   one tap.

**How we prove it.** Browser pass with the network throttled/blocked: confirm no "zeroed"
dashboard, the retry panel appears, and a toggle that fails to save does not stay lit.

---

## OPS-01 — No CI

**Fix.** Add `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm run typecheck`,
`npm test` on push and PR to `main`. The same four commands the local hook runs, so the gate exists
independently of any one machine.

**Why this and not something else.** The `.claude/` hooks are git-ignored and machine-local by
design; they protect this workstation, not the repository. CI is the only thing that protects
`main`.

**What could break.**
1. *CI fails immediately on something that only passes locally* (env vars, Node version). The
   workflow pins Node 20 and runs with no secrets — the current suite needs none.
2. *A red CI badge on every PR becomes noise if it is flaky.* The suite is deterministic today
   (no network, no DB); any test that needs either gets a fake, never a live service.

**How we prove it.** The workflow runs green on the first push; deliberately breaking a test
locally shows it would have caught it.

---

## OPS-02 — README describes a product that no longer exists

**Fix.** Rewrite `README.md` around what the code does today: live Stripe checkout, signed webhook,
Supabase persistence, family accounts, the gamified dashboard, the sticker sheet — and point at
`PROGRESS.md`/`AUDIT.md` for current status rather than duplicating it. Also fix the retail page's
stale "card handling is added in Milestone 2" line (FE-07) in the same pass, since it is the same
class of untruth.

**What could break.** Only that a reader loses the Milestone-1 history — which is what git is for.

---

# PHASE 3 — MEDIUM

**SEC-01 (Origin header).** Use `NEXT_PUBLIC_SITE_URL`; fall back to `http://localhost:3000` only
when not in production, and never to a request header. *Risk:* a production deploy that forgets the
env var now builds URLs against localhost — so the code fails loudly at request time with a clear
error instead of silently trusting an attacker's header.

**SEC-02 (rate-limit IP).** Read `x-real-ip` (set by Vercel's edge and not client-overridable)
before falling back to the first `x-forwarded-for` hop. *Risk:* behind a different proxy
`x-real-ip` may be absent or wrong, so the fallback chain stays. The per-instance limitation itself
needs Upstash/Vercel KV and is left documented, not silently "fixed".

**BUG-03 (double MailerLite sync).** Remove the sync from the success page; the webhook is the
single authoritative once-per-paid-event place. *Risk:* if the webhook is ever unconfigured, buyers
stop being added to the list — which is exactly why the webhook, not the page, must be the thing
we keep working, and BUG-01's alerting now makes a broken webhook visible.

**BUG-05 (sponsor-confirm fallback).** Make the fallback route call `recordOrder`/`markOrder` like
the webhook does. *Risk:* both paths can now write the same order — safe, because `recordOrder`
upserts on `stripe_session_id`.

**PERF-01.** Document the per-instance divergence of the local fallback stores the way
`rate-limit.ts` already documents its own, and skip the local mirror write when Supabase already
succeeded. *Risk:* dev workflows that read `data/scouts.json` to inspect state would go stale when
Supabase is configured — acceptable, and noted in the comment.

**API-03.** Reject Premium-tier wholesale checkouts with no shipping address (400), mirroring the
client-side rule. *Risk:* a client sending a partial address now gets an error where it previously
"worked" — correct, since the free copy had nowhere to ship.

**FE-03 / FE-04 / OPS-06 / OPS-07 (dead code).** Pending D3: default is to keep the code and fix
only the misleading README line, removing the two unused `.env.example` entries and the two unused
scout-store aliases (both unambiguously dead). *Risk of deleting more:* `calculateWholesalePrice`
carries the project's most thorough tests; deleting it removes real coverage in exchange for
tidiness.

**FE-05.** Add a hard guard so the print-fulfilment branch cannot ship a "Dispatched to
IngramSpark" claim without a real backend call — the flag alone is not enough. *Risk:* none; it
only blocks a future mistake.

**OPS-03.** Import `DEMO_SCOUT_TOKEN` everywhere instead of retyping `CAPTAIN-RAY-700`. *Risk:*
the client components import it from `lib/family.ts`; that module must stay free of server-only
imports or it will break the client bundle — verified it is.

**OPS-04.** Remove the stale `LULU_*` variables from `.env.local` (nothing reads them; the project
moved to IngramSpark per `PROJECT_REFERENCE.md`). *Risk:* if Lulu is somehow live again, this
deletes credentials — so it is confirmed with the user first, and `.env.local` is not in git.

**OPS-05.** Route the `family-store` session-lookup failures through `alertFailure` like every
other failure path, and fail loudly at boot in production if `ALERT_WEBHOOK_URL` is unset. *Risk:*
a missing env var would take the site down at boot — too aggressive, so it logs a startup warning
and reports through `/api/health` instead.

---

# PHASE 4 — LOW

Batched into one low-risk cleanup commit, none of which changes behaviour a user can see except
where noted:

- **SEC-03** — make "email already registered" indistinguishable from other registration failures.
  *Risk:* a parent who genuinely forgot they registered loses a helpful message; mitigated by
  keeping the friendly wording generic ("if this email is already registered, continue on your
  original device").
- **SEC-04** — cap retail quantity at 50 and reject invalid values instead of silently using 1.
- **SEC-05** — log a short hash of the scout token instead of the token, and drop the customer
  email from the happy-path log line.
- **SEC-06** — leave as an accepted risk (public demo record, no real data) unless the user wants
  it gated; documented either way.
- **SEC-07** — put the detailed `/api/health` fields behind a shared-secret header, keeping a plain
  `{ ok: true }` public so uptime monitoring still works. *Risk:* our own monitoring must send the
  header — noted in the runbook section of the README.
- **SEC-08** — trim and length-cap the wholesale metadata strings.
- **BUG-07** — merge the two `scout_profiles` upserts into one write. *Risk:* on a database where
  the `friends_completed`/`book3_sponsored` migration was never applied, a single combined write
  now fails entirely where the split version partially succeeded. Since `setup_production.sql`
  includes those columns and production is migrated, the combined write is correct — but it is
  gated on confirming the live schema first via `/api/health`.
- **BUG-08** — one shared `isValidEmail` exported from `lib/family.ts`.
- **FE-06** — focus trap, initial focus and focus restore in the Lightbox.
- **FE-07** — folded into OPS-02's copy pass.

---

---

# What the QA review caught (2026-09-23, after Phase 1 was written)

An independent reviewer went over the Phase 1 diff before it was committed and found three
CRITICAL problems **in the fixes themselves**. All are now fixed; they are recorded here because
each one is a good example of a fix quietly recreating the bug it was meant to close.

1. **The 42703 fallback recreated BUG-01.** When the database lacks the
   `friends_completed`/`book3_sponsored` columns, the retry drops them and the write succeeds —
   and the code then reported `persisted: true`. A $40 sponsorship would have been marked
   fulfilled with the unlock silently discarded. Fixed with a distinct
   `written-without-new-columns` outcome that only counts as saved when the caller did not touch
   either column. *(The FIX_PLAN had predicted exactly this risk and described the mitigation —
   and the first implementation still shipped without it. Writing the risk down is not the same
   as handling it.)*
2. **`unlockPending` was dead on arrival.** The sponsor-confirm route returned it, but
   `app/sponsor/page.tsx` only read `paid`, so a sponsor whose unlock failed still saw "Book 3 is
   now unlocked" — the same false confirmation FE-01 existed to remove, one page over. Fixed with
   a real `unlock-pending` stage.
3. **"Concurrent update" was a misdiagnosis.** When the row is absent entirely, every conditional
   write matches zero rows and the code blamed a race. Now the failure path probes for the row and
   reports which it actually was.

Also fixed from the same review: the quiz had no rollback (a failed save left it locked, answers
revealed, 0 points recorded — the single largest write on the page), and
`confirmationFromPaymentStatus` mapped *any* unrecognised status to "unpaid", which would tell a
delayed-settlement customer that nothing was charged.

**And one lesson about the tests.** The first version of the 42703 regression test passed against
the broken code — it was exercising the error path, not the degraded-write path. Mutation testing
(reverting the fix and confirming the test goes red) is what exposed it. Every test added in this
work has now been mutation-checked; a test that has never been seen to fail proves nothing.

---

## Cross-cutting risks for the whole programme of work

1. **The three CRITICAL fixes are entangled.** BUG-01 changes a return type that FE-02 depends on
   to show "not saved", and BUG-02's failure path only becomes visible because of BUG-01. They ship
   as one coherent change set with their tests, not as three unrelated commits that are each
   half-correct in between.
2. **Everything here is verified against `.env.local`-less local dev.** Several fixes behave
   differently when Supabase/Stripe are unconfigured; each one states its dev behaviour explicitly
   above, and the local path is exercised before anything is pushed.
3. **No fix is allowed to weaken a check to make a test pass** (`CLAUDE.md` §5). If a test cannot
   be written honestly, the finding is reported as still open rather than quietly closed.
4. **Nothing goes to the live site mid-way.** `main` auto-deploys to Vercel, so work stays on the
   branch until a phase is complete and verified, and the user decides when it merges.
