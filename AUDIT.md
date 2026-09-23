# AUDIT — Puen Publishing

_Audit date: 2026-09-23. Read-only audit per `CLAUDE.md` section 12 / `.claude/commands/audit.md`.
No application code was changed while producing this document._

> **Remediation status (updated 2026-09-23).** Phase 1 is complete: all 3 CRITICAL issues are
> fixed and verified, along with 4 more (BUG-02, BUG-03, BUG-07, API-02) and partial progress on
> API-01/BUG-04 and the test coverage gaps. See `FIX_PLAN.md` for the approach taken and the risks
> each fix introduces. The `Status` column in section 4 is the live record.

---

## 1. Executive summary

Overall health: **functional and reasonably well-engineered for its size, but has 3 CRITICAL
correctness/trust bugs that should be fixed before any new feature work, and no safety net
(zero API-level tests, no CI) to catch a regression if someone touches this code again.**
The team has clearly already fixed one real production bug (the Supabase stale-fetch-cache
issue) and applied good patterns in places (webhook signature verification, idempotent order
upserts, session tokens hashed, RLS default-deny) — this is not a green codebase, but the
CRITICAL issues below are all real and independently verified against the actual source.

**Counts:** 3 CRITICAL · 7 HIGH · 15 MEDIUM · 12 LOW (37 total)

**Top 5 risks, in plain language:**
1. **A family can see "your payment was processed, your book is being printed" even if they never
   paid** — `/checkout/success` never checks whether the Stripe session actually succeeded (FE-01).
2. **A child's page/quiz progress, or a paid Book‑3 sponsorship, can silently fail to save** —
   the function that writes to the database swallows every database error and reports success
   anyway (BUG-01). This also means a $40 sponsorship can be marked "fulfilled" in the order
   table when the unlock never actually happened.
3. **Nothing automated tests the API routes**, including the one route that moves money (the
   Stripe webhook). A future change can break payment processing or the points/unlock math with
   nothing catching it before it reaches Ray's live site (TEST-01).
4. **There is no CI.** The only quality gate is a Claude Code hook on one machine, and it's
   git-ignored — a different contributor, or a direct push, ships with zero automated checks
   (OPS-01).
5. **Institutional buyers ($200–$400) are told an invoice and confirmation email were sent** —
   no such system exists in the code (API-02).

None of these require Ray's input to fix; all are in code we already control.

---

## 2. Feature completion table

| Feature | Status | Evidence |
|---|---|---|
| Retail storefront + Stripe checkout ($6.99) | **Done** | `app/api/checkout/retail/route.ts`, `components/retail/BuyBox.tsx` |
| Institutional sponsorship checkout ($40/$200/$400 tiers) | **Done** (see API-03, FE-03 for gaps) | `app/api/checkout/wholesale/route.ts`, `components/institutions/WholesaleForm.tsx`, `lib/pricing.ts:SPONSOR_TIERS` |
| Stripe webhook (order recording, Book 3 unlock, MailerLite sync) | **Partial — has a correctness bug** | `app/api/webhooks/stripe/route.ts`; see BUG-01 |
| Checkout success/cancel pages | **Broken — false-positive confirmation** | `app/checkout/success/page.tsx`; see FE-01 |
| Family accounts (register, session cookie, dashboard) | **Done** | `app/start/page.tsx`, `app/api/family/*`, `lib/family-store.ts` |
| Scout gamification (points, quiz, sticker album, Book 2/3 unlock) | **Partial — real friend-referral not implemented** | `lib/gamification.ts`, `lib/scout-store.ts`; see BUG-06 |
| Sticker sheet PDF generation | **Done** | `app/api/stickers/sheet/route.ts`, `lib/stickers.ts` |
| Grandpa $40 sponsorship → Book 3 unlock | **Partial — fallback path has a gap** | `app/api/checkout/sponsor/*`; see BUG-05 |
| MailerLite buyer sync | **Done, but double-fires** | `lib/mailerlite.ts`; see BUG-03 |
| Print fulfilment (IngramSpark) | **Not started (intentionally gated)** | `PRINT_FULFILLMENT_LIVE = false` in `components/dashboard/BookUnlockCard.tsx`; see FE-05 for a landmine in the gated branch |
| Institutional per-unit pricing calculator | **Dead code — not wired to any page** | `components/institutions/PricingCalculator.tsx`, `lib/checkout.ts:initiateWholesaleCheckout`; see FE-03, FE-04 |
| CI / automated quality gate | **Not started** | no `.github/workflows`; see OPS-01 |
| API-level test coverage | **Not started (0 of 12 routes)** | see TEST-01 |

---

## 3. Automated tool results

| Tool | Result |
|---|---|
| `npm run lint` | ✅ passed, 0 errors |
| `npx tsc --noEmit` | ✅ passed, 0 errors |
| `npm test` (vitest, 28 tests) | ✅ all passed — but only 2 of 17 `lib/` modules have any test file, and 0 of 12 API routes (see TEST-01, TEST-02) |
| `npm run build` (production build) | ✅ succeeds, all 20 routes compile |
| `npm audit` | ⚠️ **Partly resolved 2026-09-23.** Was 2 vulnerabilities on `next@14.2.15` (DoS, SSRF, cache poisoning, plus Windows-host and AVIF Image-Optimization RCE advisories). Upgraded to **`next@14.2.35`** (same major, no breaking changes; lint/typecheck/48 tests/build all pass). The remote-code-execution advisories are gone; what remains on the 14.x line is DoS-class (`Image Optimizer remotePatterns` — self-hosted only, this app is on Vercel; RSC request deserialization; `rewrites` smuggling — this app defines no rewrites) plus build-time-only `postcss` advisories. Clearing those entirely needs `next@16`, a genuinely breaking upgrade deliberately deferred. |
| Committed secrets scan (tracked files + full git history, all branches, for `sk_test_`/`sk_live_`/`whsec_` patterns) | ✅ clean — only a non-functional placeholder string in `lib/stripe.ts:6` (`sk_test_placeholder_key_to_allow_nextjs_build_time_evaluation`, used solely so `new Stripe()` doesn't throw at build time). `.env.example` contains no real values. **Note:** `PROGRESS.md`/`NEXT_SESSION_HANDOFF.md` (task t09) claim a real Stripe key was exposed in git history — this could not be confirmed in this repository's current history; it may refer to an earlier archive/zip not part of this git history, or history that was rewritten. Flagged for clarification, not claimed as fixed. |
| CI pipeline | ❌ none exists (`.github/workflows` absent) — see OPS-01 |

---

## 4. Issue register

| ID | Severity | Category | Title | Location | Effort | Confidence | Status |
|---|---|---|---|---|---|---|---|
| BUG-01 | CRITICAL | Correctness | `updateScoutAsync` reports success even when the DB write fails | lib/scout-store.ts:248-313 | M | HIGH | **FIXED 2026-09-23** |
| FE-01 | CRITICAL | Frontend | Checkout success page confirms payment/dispatch with no payment-status check | app/checkout/success/page.tsx:17-77 | S | HIGH | **FIXED 2026-09-23** |
| TEST-01 | CRITICAL | Tests | Zero test coverage for all 12 API routes, including the Stripe webhook | app/api/**/route.ts | L | HIGH | PARTIAL — scout-store + checkout-status covered (17 new tests, mutation-verified); webhook route tests still open |
| BUG-02 | HIGH | Correctness | Read-modify-write race on scout progress can lose updates | lib/scout-store.ts:252-263; app/dashboard/book2/page.tsx:91-98 | L | HIGH | **FIXED 2026-09-23** (optimistic concurrency + retry) |
| API-01 | HIGH | API/Integration | Success page blocks on Stripe+MailerLite with no timeout — can hang | app/checkout/success/page.tsx:17-46; lib/stripe.ts; lib/mailerlite.ts | M | HIGH | PARTIAL — Stripe timeout added and the blocking MailerLite call removed; MailerLite/Supabase timeouts still open (BUG-04) |
| API-02 | HIGH | API/Integration | Wholesale success copy claims an invoice/email was sent — not implemented | app/checkout/success/page.tsx:62 | M | HIGH | **FIXED 2026-09-23** — Stripe `invoice_creation` enabled on the wholesale session, so the claim is now true. ⚠️ Depends on "Email finalized invoices" being ON in the Stripe dashboard (Settings → Billing → Invoices) — confirm before launch |
| FE-02 | HIGH | Frontend | Dashboard silently shows zeroed progress on fetch failure; optimistic sticker toggle can drift from server state | app/dashboard/book2/page.tsx:42-98 | M | HIGH | **FIXED 2026-09-23** |
| OPS-01 | HIGH | Ops | No CI — quality gate only exists as a gitignored local hook | (absence of) .github/workflows; .gitignore:34 | S | HIGH | OPEN |
| OPS-02 | HIGH | Code Health | README.md describes a stale "Milestone 1, stub checkout" state | README.md:1-8,53-56,137-153 | S | HIGH | OPEN |
| TEST-02 | HIGH | Tests | Business-critical lib logic (scoring, unlock, auth boundary, real charged pricing tiers) untested; test effort instead sits on dead code | lib/scout-store.ts, lib/scout-access.ts, lib/gamification.ts, lib/family-store.ts, lib/pricing.ts:SPONSOR_TIERS | L | HIGH | PARTIAL — `deriveScoutFields` thresholds fully covered; `resolveScoutAccess`, `gradeQuiz`, `SPONSOR_TIERS`, `family-store` still open |
| SEC-01 | MEDIUM | Security | Stripe success/cancel URL falls back to an unvalidated client `Origin` header | app/api/checkout/{retail,sponsor,wholesale}/route.ts | S | HIGH | OPEN |
| SEC-02 | MEDIUM | Security | Rate limiter is per-instance and its IP extraction trusts a spoofable header | lib/rate-limit.ts:15,41-49 | M | HIGH | OPEN |
| BUG-03 | MEDIUM | Correctness | MailerLite sync fires twice per order with no idempotency guard | app/checkout/success/page.tsx:16-46; app/api/webhooks/stripe/route.ts:108-130 | S | MEDIUM | **FIXED 2026-09-23** (duplicate sync removed from the success page; the webhook is now the single source) |
| BUG-04 | MEDIUM | Correctness | No timeout on any external call (Supabase, Stripe, MailerLite) | lib/supabase.ts:20; lib/stripe.ts:8-10; lib/mailerlite.ts:48-58 | S | HIGH | PARTIAL — Stripe done (8s + 1 retry); Supabase and MailerLite still open |
| BUG-05 | MEDIUM | Correctness | Sponsor-confirm fallback path never records an order or syncs MailerLite | app/api/checkout/sponsor/confirm/route.ts | S | HIGH | OPEN |
| BUG-06 | MEDIUM | Correctness | Real (non-demo) friend-referral counting is not implemented | app/api/scout/update/route.ts:78-93 | L | HIGH | OPEN — needs product clarification |
| PERF-01 | MEDIUM | Scalability | Local fallback stores diverge per serverless instance; undocumented, plus a redundant mirror write | lib/scout-store.ts:84-94,152-162,307-310; lib/family-store.ts:29-52 | S/M | HIGH | OPEN |
| API-03 | MEDIUM | API/Integration | Wholesale checkout doesn't require a shipping address server-side for Premium tiers | app/api/checkout/wholesale/route.ts:55-61 | S | HIGH | OPEN |
| FE-03 | MEDIUM | Frontend | `initiateWholesaleCheckout` is dead code whose payload contract has drifted from the live route | lib/checkout.ts:107-137 | S | HIGH | **FIXED 2026-09-23** — removed along with its unused payload types |
| FE-04 | MEDIUM | Frontend | `PricingCalculator` + `calculateWholesalePrice` are dead code; README still calls it "live" | components/institutions/PricingCalculator.tsx; README.md:124 | S | HIGH | **FIXED 2026-09-23** — component deleted and the whole per-copy pricing model removed from `lib/pricing.ts`; its 19 tests were replaced with tests of the tiers actually charged |
| FE-05 | MEDIUM | Frontend | `BookUnlockCard`'s gated branch has no backend call — false "dispatched" claim will reappear if the flag flips without also wiring fulfilment | components/dashboard/BookUnlockCard.tsx:68-71,198 | S | HIGH | OPEN |
| OPS-03 | MEDIUM | Code Health | Demo token `CAPTAIN-RAY-700` re-typed as a literal in 4 places instead of importing the constant | lib/scout-store.ts:85,165,318; app/dashboard/book2/page.tsx:15; app/sponsor/page.tsx:9 | S | HIGH | OPEN |
| OPS-04 | MEDIUM | Code Health | Print-vendor docs mismatch: `.env.local` has Lulu vars, README/.env.example say IngramSpark, neither is wired into code | .env.local (names only); README.md:5-7; .env.example:32-35 | S | MEDIUM | OPEN — needs confirmation of current vendor |
| OPS-05 | MEDIUM | Ops | No structured alerting beyond an optional webhook URL; several failure paths only `console.error` | lib/alerts.ts:14-15; lib/family-store.ts:153,165 | M | HIGH | OPEN |
| SEC-03 | LOW | Security | Account enumeration via family-registration error message/status code | app/api/family/register/route.ts:38-46 | S | HIGH | OPEN |
| SEC-04 | LOW | Security | Retail checkout quantity has no upper bound and silently coerces invalid input to 1 instead of rejecting | app/api/checkout/retail/route.ts:22-23 | S | HIGH | OPEN |
| SEC-05 | LOW | Security | Customer email + scout token written to logs and the outbound alert webhook | app/api/webhooks/stripe/route.ts:42,87,92-97 | S | HIGH | OPEN |
| SEC-06 | LOW | Security | Demo token's shared record is an unauthenticated public write target | lib/scout-access.ts:14-18; lib/scout-store.ts:84-94 | S | HIGH | OPEN |
| SEC-07 | LOW | Security | `/api/health` discloses infrastructure fingerprinting details, unauthenticated | app/api/health/route.ts; lib/supabase.ts:39-69 | S | HIGH | OPEN |
| SEC-08 | LOW | Security | Wholesale metadata fields (institution name, phone, address) accepted with no validation/length cap | app/api/checkout/wholesale/route.ts:50-61 | S | MEDIUM | OPEN |
| BUG-07 | LOW | Correctness | Two sequential, non-atomic upserts in `updateScoutAsync` can leave a briefly half-updated row | lib/scout-store.ts:266-301 | S | HIGH | **FIXED 2026-09-23** — merged into one write (required by BUG-02's concurrency guard), with a 42703 fallback for un-migrated databases |
| BUG-08 | LOW | Correctness | Email regex duplicated 3× with an inconsistent TLD-length rule | lib/family.ts:23; lib/mailerlite.ts:4; app/api/checkout/wholesale/route.ts:9 | S | HIGH | OPEN |
| FE-06 | LOW | Frontend | Lightbox modal lacks focus trapping / focus management (accessibility) | components/ui/Lightbox.tsx:31-113 | S | HIGH | OPEN |
| FE-07 | LOW | Frontend | Stale "[Placeholder]... Milestone 2" copy undersells the already-live Stripe checkout | components/retail/ShippingReturns.tsx:17 | S | HIGH | OPEN |
| OPS-06 | LOW | Code Health | `.env.example` documents two env vars that are never read in code | .env.example:24,30 | S | HIGH | **FIXED 2026-09-23** |
| OPS-07 | LOW | Code Health | Unused dead export aliases (`getOrCreateScout`, `updateScout`) | lib/scout-store.ts:375-376 | S | HIGH | **FIXED 2026-09-23** |

---

## 5. Issue details

### BUG-01 — `updateScoutAsync` reports success even when the DB write fails
**Severity:** CRITICAL · **Category:** Correctness · **Effort:** M · **Confidence:** HIGH (verified directly)

**Location:** `lib/scout-store.ts:248-313`

**Evidence** (verified by reading the file directly):
```ts
if (saveError) {
  reportDbProblem('Scout progress save failed', { error: errText(saveError) });
}
...
} catch (err) {
  reportDbProblem('Scout progress save threw', { error: errText(err) });
}
...
return updated;   // always returns the locally-computed object, regardless of saveError
```
Every branch that detects a Supabase error only logs/alerts (`reportDbProblem`) — it never
returns or throws a failure signal. The function unconditionally returns the in-memory
`updated` object as if it had been persisted.

**Problem:** Callers cannot distinguish "saved" from "failed to save." Concretely, in
`app/api/webhooks/stripe/route.ts:83-98`:
```ts
await updateScoutAsync(grandpaToken, { book3Sponsored: true });
console.log(`[Grandpa Sponsor] Book 3 unlocked for scout ${grandpaToken}`);
await markOrder(session.id, { fulfillmentStatus: "fulfilled", lastError: null });
```
is wrapped in a try/catch that only fires on a *thrown* exception — never on a Supabase error
object, which `updateScoutAsync` never throws. So a real DB failure here still results in
`markOrder(... "fulfilled" ...)`, Stripe stops retrying, and the order is permanently marked
fulfilled even though `book3_sponsored` was never actually written.

**Impact:** A parent pays $40, sees a success screen, and the child's Book 3 unlock may never
actually take effect — with the system believing it did. The same silent-failure applies to
every quiz/score/page-completion write from `/api/scout/update`: a child's progress can be
dropped on any transient Supabase error, with nothing surfacing it to the family or to Ray.

**Fix:** Change `updateScoutAsync` to return a discriminated result, e.g.
`{ ok: true; state } | { ok: false; state; persisted: false }`, and make every caller act on
it — the webhook must keep `retryNeeded = true` and must not call `markOrder(... "fulfilled" ...)`
on a failed write; `/api/scout/update` and the sponsor-confirm route must surface a 5xx or a
`persisted: false` flag instead of a bare success response.

---

### FE-01 — Checkout success page confirms payment/dispatch with no payment-status check
**Severity:** CRITICAL · **Category:** Frontend · **Effort:** S · **Confidence:** HIGH (verified directly)

**Location:** `app/checkout/success/page.tsx:17-77`

**Evidence** (verified by reading the file directly):
```tsx
if (sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    ...
  } catch (e) {
    console.warn("Direct MailerLite sync warning:", e);
  }
}
return (
  ...
  <p>{isWholesale ? "...invoice have been dispatched..." :
      "Your payment has been successfully processed. Your coloring book is now being
       queued for printing and fulfillment."}</p>
  <li>Dispatched directly to your address within 2–3 business days</li>
```
`session.payment_status` (or `session.status`) is never read. If `sessionId` is missing,
the Stripe lookup throws (invalid/expired id), or the session exists but was never paid, the
`catch` block only logs a warning — execution continues straight to the `return`, which
**always** renders the "payment processed / dispatched" message and bullet list.

**Impact:** Anyone (no authentication required) can load `/checkout/success` directly, or with
a stale/invalid `session_id`, and see a false purchase confirmation claiming their book is being
printed and will ship in 2–3 days. This is the same class of "false dispatch" bug the client
already flagged once for the dashboard (see `PRINT_FULFILLMENT_LIVE`), now present on the
public checkout confirmation page with no gate at all.

**Fix:** Require `session.payment_status === "paid"` (or `session.status === "complete"`)
before rendering any fulfilment claim. When `sessionId` is missing, retrieval fails, or the
session isn't paid, render a neutral/error state with no fulfilment bullet points — mirroring
the pattern already used correctly in `app/api/checkout/sponsor/confirm/route.ts:38-46`.

---

### TEST-01 — Zero test coverage for all 12 API routes, including the Stripe webhook
**Severity:** CRITICAL · **Category:** Tests · **Effort:** L · **Confidence:** HIGH (verified directly)

**Location:** `app/api/**/route.ts` (12 files); `vitest.config.ts` only includes `lib/**/*.test.ts`

**Evidence:** `find app -path "*/route.ts"` lists 12 route files; a repo-wide search for any
`*.test.ts`/`*.spec.ts` file returns exactly two: `lib/family.test.ts`, `lib/pricing.test.ts`.
Neither references anything under `app/api`.

**Problem:** The Stripe webhook (`app/api/webhooks/stripe/route.ts`) — which persists paid
orders, unlocks Book 3, and syncs MailerLite — has no test for signature verification,
idempotency (replaying the same event), the `retryNeeded`/500 path, or the `grandpaToken` regex
gate. The same is true for registration, session/cookie handling, and both checkout-session
creators.

**Impact:** A refactor of order recording, the token regex, or the retry/alert logic can
silently break real payment fulfilment, with nothing in `npm test` or CI catching it before it
reaches production.

**Fix:** At minimum, add integration tests for: webhook signature rejection, one
`checkout.session.completed` test per `order_type` (asserting the order row and, for Grandpa
sponsorship, the unlock), and the family register → session-cookie → `/api/family/me` round trip.

---

### BUG-02 — Read-modify-write race on scout progress can lose updates
**Severity:** HIGH · **Category:** Correctness · **Effort:** L · **Confidence:** HIGH (verified directly)

**Location:** `lib/scout-store.ts:252-263` (`updateScoutAsync`); triggered concretely by
`app/dashboard/book2/page.tsx:91-98` (`handleTogglePage`, fires one POST per click, no debounce)

**Evidence:**
```ts
const current = await getOrCreateScoutAsync(token);
const merged = { ...current, ...partial };
const updated = deriveScoutFields({ ...merged, ... });
...
await supabase.from('scout_profiles').upsert({...}, { onConflict: 'token' });
```
No optimistic-concurrency check (no version/`updated_at` comparison), no atomic DB-side merge.

**Problem:** Two nearly-simultaneous requests for the same token (a child clicking through
several stickers quickly, or the webhook and a scout-update racing) each read the same snapshot
and the later write silently overwrites the earlier one's changes to any overlapping field
(`completedPages`, `quizScore`, `status`, `scoutName`).

**Impact:** A colored page or quiz score can be silently dropped, directly affecting the
700-point Book 2 unlock and the Grandpa Book 3 unlock — the core reward mechanic — with no error
surfaced to anyone.

**Fix:** Either move the merge into a Postgres RPC/transaction that does it atomically
server-side (e.g. `completed_pages = completed_pages || new_page`), or add optimistic
concurrency (`.eq('updated_at', current.updatedAt)` with retry-on-conflict). Client-side,
debounce/cancel in-flight update calls per field.

---

### API-01 — Success page blocks on Stripe+MailerLite with no timeout
**Severity:** HIGH · **Category:** API/Integration · **Effort:** M · **Confidence:** HIGH

**Location:** `app/checkout/success/page.tsx:17-46`; `lib/stripe.ts:8-10`; `lib/mailerlite.ts:48-58`

**Evidence:** A repo-wide grep for `timeout|AbortController|signal:` returns no matches. The
success page is an async Server Component that `await`s Stripe then MailerLite sequentially,
before returning any JSX, and there is no `app/checkout/loading.tsx`.

**Impact:** If Stripe or MailerLite is slow/down, a customer who just paid sees a blank tab
until the platform's own function timeout kills the request, with no user-facing message.

**Fix:** Wrap both calls with an explicit timeout (Stripe SDK's `timeout` option;
`AbortController` for the MailerLite `fetch`), and/or drop the render-blocking MailerLite call
here since the webhook already does it (`app/api/webhooks/stripe/route.ts:108-130`). Add
`app/checkout/loading.tsx`.

---

### API-02 — Wholesale success copy claims an invoice/email was sent — not implemented
**Severity:** HIGH · **Category:** API/Integration · **Effort:** M · **Confidence:** HIGH

**Location:** `app/checkout/success/page.tsx:62`

**Evidence:** The copy reads: *"A confirmation email and invoice have been dispatched to your
contact email address."* A repo-wide search for `invoice`, `sendEmail`, `nodemailer`, `resend`,
`sendgrid` finds no matches outside this string; `app/api/checkout/wholesale/route.ts` never
sets Stripe's `invoice_creation.enabled`. The only server action on a completed order is adding
the buyer to a MailerLite marketing list — not sending an invoice or a confirmation email.

**Impact:** Institutional buyers paying $200-$400 are told to expect paperwork they typically
need for reimbursement/accounting, and it never arrives.

**Fix:** Either enable Stripe's built-in `invoice_creation` on the wholesale session (or build a
transactional email), or change the copy to state what actually happens (e.g. "you'll receive a
payment receipt from Stripe; our team will follow up by email").

---

### FE-02 — Dashboard silently shows zeroed progress on fetch failure
**Severity:** HIGH · **Category:** Frontend · **Effort:** M · **Confidence:** HIGH

**Location:** `app/dashboard/book2/page.tsx:42-98`

**Evidence:** `res.ok`/`res.status` is never checked after `fetch("/api/scout/state")`; only a
`401` is special-cased (redirect to `/start`). On a `429` (rate-limited) or `500`, the response
body has no `scout` key, so `applyScout` is skipped and the component silently falls back to its
`useState` defaults (0 points, no completed pages). `handleTogglePage` also optimistically marks
a sticker complete in local state *before* `persistUpdate` confirms the save, with no rollback
on failure.

**Impact:** A returning family whose child has real progress could see the dashboard render as
if reset to zero on a transient hiccup, with no error or retry option — a serious trust problem
for a product built around visible rewards. A sticker can visually appear "done" when it was
never actually saved.

**Fix:** Check `res.ok` explicitly; show a retry banner on non-401 failure instead of falling
through to defaults. Roll back the optimistic UI update in `handleTogglePage` if `persistUpdate`
fails.

---

### OPS-01 — No CI; quality gate only exists as a gitignored local hook
**Severity:** HIGH · **Category:** Ops · **Effort:** S · **Confidence:** HIGH

**Location:** absence of `.github/workflows`; `.gitignore:34` (`/.claude/`)

**Evidence:** `.github` does not exist. `.claude/` (which holds the newly-added
`CLAUDE.md`-driven hooks that run lint/typecheck/test) is git-ignored, confirmed via
`git check-ignore -v .claude`.

**Impact:** The only enforcement of lint/typecheck/test before a change ships is a machine-local
Claude Code hook. Any other contributor, a fresh clone, or a direct push to `main` has zero
automated gate before Vercel deploys it.

**Fix:** Add `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npx tsc --noEmit`,
`npm test` on push/PR to `main`.

---

### OPS-02 — README.md describes a stale "Milestone 1, stub checkout" state
**Severity:** HIGH · **Category:** Code Health · **Effort:** S · **Confidence:** HIGH

**Location:** `README.md:1-8, 53-56, 137-153`

**Evidence:** README.md says *"This is Milestone 1 of 2"*, that Buy/Submit buttons "call stub
functions... log it to the browser console... No payment is taken," and lists Stripe/MailerLite/
Supabase under "Milestone 2 (not built yet)." The actual code has all of these live.
(Related, opposite-direction instance: `components/retail/ShippingReturns.tsx:17` still says
card handling is "added in Milestone 2" on the live storefront right next to a real Stripe
checkout and a sandbox-test-card notice — see FE-07.)

**Impact:** Any new developer (or AI agent, or the client) reading README.md will believe the
site takes no real payments, when live Stripe charges, a webhook, and a database are in
production — actively misleading for onboarding and incident response.

**Fix:** Rewrite README.md to reflect the current architecture, or replace it with a pointer to
whichever doc is meant to be the living status source (`PROJECT_STATUS_AND_HANDOVER_REPORT.md`
in this repo, or `NEXT_SESSION_HANDOFF.md` in the parent folder).

---

### TEST-02 — Business-critical lib logic untested; test effort sits on dead code
**Severity:** HIGH · **Category:** Tests · **Effort:** L · **Confidence:** HIGH

**Location:** `lib/scout-store.ts` (`deriveScoutFields`), `lib/scout-access.ts`
(`resolveScoutAccess`), `lib/gamification.ts` (`gradeQuiz`), `lib/family-store.ts`
(registration/session), `lib/pricing.ts` (`SPONSOR_TIERS`)

**Evidence:** `lib/pricing.test.ts` exhaustively tests `calculateWholesalePrice` (the 99/100/101
boundary) — but that function is only reachable from `components/institutions/PricingCalculator.tsx`,
which is never imported anywhere (see FE-04). Meanwhile `SPONSOR_TIERS`, the table that actually
prices the $40/$200/$400 charges in `app/api/checkout/wholesale/route.ts`, has zero test
coverage. `deriveScoutFields` — the single function computing `hasPassedQuiz`, `book2Unlocked`,
`hasRecruitedFriend`, and `status` — has no test despite being at least as consequential as the
pricing boundary the team clearly cared enough to test rigorously.

**Impact:** The highest-risk, most financially- and concurrency-sensitive logic in the repo is
untested, while real test investment sits on a component that isn't wired into any live page.

**Fix:** Add unit tests for `deriveScoutFields` and `resolveScoutAccess` first (pure functions,
same style as `pricing.test.ts`), then `SPONSOR_TIERS`/wholesale checkout and webhook idempotency.

---

### SEC-01 — Stripe success/cancel URL falls back to an unvalidated `Origin` header
**Severity:** MEDIUM · **Category:** Security · **Effort:** S · **Confidence:** HIGH (code
confirmed in all 3 files; live exploitability depends on whether `NEXT_PUBLIC_SITE_URL` is set
in Vercel, which cannot be checked from the repo)

**Location:** `app/api/checkout/{retail,sponsor,wholesale}/route.ts`

**Evidence:**
```ts
const origin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  request.headers.get("origin") ||
  "http://localhost:3000";
...
success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
```

**Problem:** If `NEXT_PUBLIC_SITE_URL` isn't set, `origin` falls back to a client-controlled
`Origin` header with no allow-list check, then is interpolated straight into the Stripe-hosted
checkout's `success_url`/`cancel_url`.

**Impact:** An attacker can request checkout-session creation with a forged `Origin` header and
receive back a real, valid Stripe-hosted checkout URL that redirects to their own domain after
payment — usable for phishing under Puen's own Stripe branding.

**Fix:** Never fall back to the request header. Always use `NEXT_PUBLIC_SITE_URL`, with a
hardcoded production origin as the only fallback.

---

### SEC-02 — Rate limiter is per-instance and its IP extraction trusts a spoofable header
**Severity:** MEDIUM · **Category:** Security · **Effort:** S (IP-parsing fix) / M (shared store)
· **Confidence:** HIGH (code-level issue certain; real-world exploitability on Vercel's specific
edge config not independently tested)

**Location:** `lib/rate-limit.ts:15, 41-49`

**Evidence:** The bucket is an in-process `Map` (already self-documented in the file's own
comment as "NOT a shared/global limit"). `clientIp()` takes the *first* comma-separated value of
`X-Forwarded-For`, which a client can prepend arbitrary values to.

**Impact:** Registration (5/hr), checkout (10/min), and scout-update (30/min) limits can be
defeated by rotating a spoofed header per request or simply by virtue of hitting different
serverless instances, enabling sign-up spam or Stripe API abuse.

**Fix:** Prefer Vercel's own `x-real-ip` (harder for a client to override) over the first
`x-forwarded-for` entry; for real protection, back the limiter with Upstash Redis/Vercel KV as
the file's own comment already recommends.

---

### BUG-03 — MailerLite sync fires twice per order with no idempotency guard
**Severity:** MEDIUM · **Category:** Correctness · **Effort:** S · **Confidence:** MEDIUM (the
double-call is certain; whether it causes a duplicate customer-facing email depends on MailerLite
account automation config, which is outside the repo)

**Location:** `app/checkout/success/page.tsx:16-46`; `app/api/webhooks/stripe/route.ts:108-130`

**Evidence:** The success page (a `force-dynamic` server component, re-run on every reload) syncs
MailerLite directly; the webhook independently syncs the same order on every delivery/retry.
Neither checks whether this session was already synced.

**Impact:** If any MailerLite group-assignment automation emails the customer, a page refresh or
a webhook retry re-fires it, potentially double-sending a customer-facing email.

**Fix:** Sync only from the webhook (the authoritative once-per-paid-event source), gated on
whether the order row already has a set `fulfillment_status`; drop the direct sync in the
success page.

---

### BUG-04 — No timeout on any external call
**Severity:** MEDIUM · **Category:** Correctness · **Effort:** S · **Confidence:** HIGH

**Location:** `lib/supabase.ts:20-27`; `lib/stripe.ts:8-10`; `lib/mailerlite.ts:48-58`

**Evidence:** A repo-wide grep for `timeout|AbortController|signal:` returns zero matches in any
`.ts`/`.tsx` file. Every external call relies entirely on the platform's own function timeout.

**Impact:** A slow/hanging Supabase, Stripe, or MailerLite response occupies an entire
serverless invocation, degrading checkout/scout-state/webhook requests under any real latency,
rather than failing fast with a clear error.

**Fix:** Add an `AbortController`-based timeout (5-8s) to the Supabase client's fetch and the
MailerLite fetch; pass `{ timeout: <ms> }` to the `Stripe` constructor.

---

### BUG-05 — Sponsor-confirm fallback path never records an order or syncs MailerLite
**Severity:** MEDIUM · **Category:** Correctness · **Effort:** S · **Confidence:** HIGH

**Location:** `app/api/checkout/sponsor/confirm/route.ts`

**Evidence:** The route's own comment says it exists to "guarantee the unlock even when the
Stripe webhook is not yet configured," but unlike the webhook it never calls `recordOrder`,
`markOrder`, or `addSubscriberToMailerLite`.

**Impact:** If the Stripe webhook is ever missing/misconfigured in the Stripe Dashboard (exactly
the scenario this fallback exists to cover), every Grandpa sponsorship confirmed this way leaves
zero financial record and the sponsor is never added to MailerLite — while the buyer's UI shows
full success, so nobody notices.

**Fix:** Have this route also call `recordOrder`/`markOrder` (and the MailerLite sync),
mirroring the webhook for the same `order_type`.

---

### BUG-06 — Real (non-demo) friend-referral counting is not implemented
**Severity:** MEDIUM · **Category:** Correctness · **Effort:** L · **Confidence:** HIGH (code
absent) — **needs product clarification, not necessarily a bug**

**Location:** `app/api/scout/update/route.ts:78-93`

**Evidence:** The code comment says: *"In production this count is driven by the friends' own
logins; here we only accept demo controls..."* — but no endpoint exists anywhere for a real
friend to log in via a share code and register their own Page-1 completion against the inviting
family's scout row.

**Impact:** For any real family, the documented "invite 2 of 3 friends for 300 points" mechanic
cannot currently be triggered outside the demo flag. This may be intentional/roadmap — flagged
per audit rules for reporting unimplemented paths a comment claims exist "in production."

**Fix (if in scope):** Build the actual friend-referral flow, with its own idempotency (a given
friend can only count once).

---

### PERF-01 — Local fallback stores diverge per serverless instance; undocumented, plus a redundant write
**Severity:** MEDIUM · **Category:** Scalability · **Effort:** S (docs) / M (remove redundant write)
· **Confidence:** HIGH

**Location:** `lib/scout-store.ts:84-94, 152-162, 307-310`; `lib/family-store.ts:29-52`

**Evidence:** Unlike `lib/rate-limit.ts`, which explicitly documents its per-instance limitation,
the equivalent divergence risk for the scout/family in-memory fallback maps is undocumented.
`updateScoutAsync` also always performs a local filesystem mirror write (lines 307-310) even
when the Supabase write already succeeded.

**Impact:** When Supabase is unset or momentarily failing, different concurrent serverless
instances mutate disjoint copies of state — a child's progress can appear to reset depending on
which instance handles the next request. Worse at higher concurrent traffic, not better.

**Fix:** Document the limitation as explicitly as `rate-limit.ts` does; consider skipping the
local-mirror write when the Supabase write already succeeded.

---

### API-03 — Wholesale checkout doesn't require a shipping address server-side for Premium tiers
**Severity:** MEDIUM · **Category:** API/Integration · **Effort:** S · **Confidence:** HIGH

**Location:** `app/api/checkout/wholesale/route.ts:55-61`

**Evidence:** The client (`WholesaleForm.tsx`) enforces "Tier 2/3 requires a shipping address,"
but the API route only *optionally* attaches `sponsor_shipping` to Stripe metadata if present —
it never rejects a Premium-tier request that's missing one.

**Impact:** Any direct API call (a future client bug, a retry tool, curl) can produce a paid
$200/$400 order with no address to ship the promised free copy to, with no error anywhere.

**Fix:** Reject (400) when `tier.isPremiumSponsor` is true and `shippingAddress` is
missing/incomplete, mirroring the client-side check server-side.

---

### FE-03 — `initiateWholesaleCheckout` is dead code with a drifted contract
**Severity:** MEDIUM · **Category:** Frontend · **Effort:** S · **Confidence:** HIGH

**Location:** `lib/checkout.ts:107-137`

**Evidence:** `initiateWholesaleCheckout` posts `{contact, shippingAddress, quantity}`; the live
route (`app/api/checkout/wholesale/route.ts`) expects `{tierId, institution, shippingAddress}`.
A repo-wide grep confirms `initiateWholesaleCheckout` is never called — `WholesaleForm.tsx`
bypasses it with its own direct `fetch`.

**Impact:** Currently harmless (unused), but a future "cleanup" that wires `WholesaleForm.tsx`
to this seemingly-canonical helper (named in parallel with the *used* `initiateRetailCheckout`)
would silently break wholesale checkout.

**Fix:** Delete it (and its associated dead types), or update its shape and have
`WholesaleForm.tsx` actually use it.

---

### FE-04 — `PricingCalculator` is dead code; README calls it "live"
**Severity:** MEDIUM · **Category:** Frontend · **Effort:** S · **Confidence:** HIGH

**Location:** `components/institutions/PricingCalculator.tsx`; `README.md:124`

**Evidence:** `app/institutions/page.tsx` only renders `<WholesaleForm />`. A repo-wide grep for
`PricingCalculator` finds only its own definition and the README reference. It models a
different, superseded per-unit pricing scheme (`WHOLESALE_UNIT_PRICE`/`DIGITAL_FEE`) than the
flat `SPONSOR_TIERS` the live page actually uses.

**Impact:** Wasted bundle size, and README actively misdocuments the current architecture,
which will mislead a future developer (or AI agent) into thinking a live calculator exists.

**Fix:** Delete `PricingCalculator.tsx` and its `lib/pricing.ts` exports if truly superseded, or
correct the README.

---

### FE-05 — `BookUnlockCard`'s gated branch has no backend call
**Severity:** MEDIUM · **Category:** Frontend · **Effort:** S (guard) / M (real wiring) ·
**Confidence:** HIGH

**Location:** `components/dashboard/BookUnlockCard.tsx:68-71, 198`

**Evidence:** `handleConfirmShipping` is pure local `useState` — no `fetch` call — right next to
copy that reads *"Order Successfully Dispatched to IngramSpark!"* The current code is correctly
gated behind `PRINT_FULFILLMENT_LIVE = false`, but the un-flagged branch has zero submission
logic behind it.

**Impact:** If `PRINT_FULFILLMENT_LIVE` is flipped to `true` (the documented intent once
IngramSpark access exists) without also wiring a real dispatch call, the exact same false
"dispatched" claim the client already flagged as a bug reappears immediately, and the address
the family typed is never actually sent anywhere.

**Fix:** When wiring real fulfilment, make `handleConfirmShipping` call a real API and only show
"Dispatched" after a successful response; until then, add a `// TODO` guard so it can't ship
silently.

---

### OPS-03 — Demo token duplicated as a literal in 4 places
**Severity:** MEDIUM · **Category:** Code Health · **Effort:** S · **Confidence:** HIGH

**Location:** `lib/scout-store.ts:85, 165, 318`; `app/dashboard/book2/page.tsx:15`;
`app/sponsor/page.tsx:9`

**Evidence:** `lib/family.ts:16` defines `export const DEMO_SCOUT_TOKEN = "CAPTAIN-RAY-700"`, but
four other locations re-type the same string literal instead of importing the constant.

**Impact:** If the demo token is ever rotated, a developer editing only `lib/family.ts` will
silently miss the re-typed copies, leaving stale/inconsistent fallback tokens.

**Fix:** Import `DEMO_SCOUT_TOKEN` from `@/lib/family` everywhere instead of retyping it.

---

### OPS-04 — Print-vendor docs mismatch (Lulu vs IngramSpark)
**Severity:** MEDIUM · **Category:** Code Health · **Effort:** S · **Confidence:** MEDIUM
(vendor-name mismatch confirmed; which vendor is actually correct going forward needs
confirmation)

**Location:** `.env.local` (variable *names* only — `LULU_API_BASE_URL`, `LULU_CLIENT_KEY`,
`LULU_CLIENT_SECRET`); `README.md:5-7`; `.env.example:32-35` (both say IngramSpark)

**Evidence:** No `process.env.LULU_*` usage exists anywhere in `app/`/`lib/` — these vars are
unused by any code path.

**Note added during this audit:** `PROJECT_REFERENCE.md` (2026-09-20, this workspace's older
reference doc) records that the print UI was **switched from Lulu to IngramSpark** — so the
Lulu variables in `.env.local` are most likely stale leftovers from before that switch, not a
sign of reverting back to Lulu. `README.md`/`.env.example` (IngramSpark) most likely reflect the
current intent correctly; `.env.local` is what's stale.

**Impact:** Low on its own (the vars are inert), but confusing for anyone auditing "what's
actually wired up," and confirms `.env.example` isn't fully in sync with local dev files.

**Fix:** Remove the unused `LULU_*` vars from `.env.local` (or confirm with Ray if Lulu is
somehow back in play, which current evidence doesn't support).

---

### OPS-05 — No structured alerting beyond an optional webhook URL
**Severity:** MEDIUM · **Category:** Ops · **Effort:** M · **Confidence:** HIGH (no alternative
logging exists in code); MEDIUM whether anyone would actually miss an alert in the live
environment (cannot see actual Vercel/Slack configuration from the repo)

**Location:** `lib/alerts.ts:14-15`; `lib/family-store.ts:153, 165` (console.error only, no
`alertFailure` call)

**Evidence:** `alertFailure` silently no-ops if `ALERT_WEBHOOK_URL` isn't set
(`.env.example:65` ships it blank by default). Session-lookup failures in `family-store.ts`
only `console.error`, bypassing `alertFailure` entirely even though it's already used elsewhere
in the same file.

**Impact:** If a production error occurs outside business hours (Supabase down, webhook 500ing,
registration silently failing), the only trace may be a Vercel function log nobody is watching.

**Fix:** Confirm `ALERT_WEBHOOK_URL` is actually set in production; extend `alertFailure`
coverage to the family-store.ts session-lookup error paths; consider failing loudly at boot in
production if the alert URL is unset (mirroring the `isProduction` pattern in `lib/supabase.ts`).

---

### SEC-03 — Account enumeration via family-registration error message
**Severity:** LOW · **Category:** Security · **Effort:** S · **Confidence:** HIGH

**Location:** `app/api/family/register/route.ts:38-46`

**Evidence:** Returns a distinct message and status code (409 vs 503) specifically for
`email_taken`, weakly rate-limited (5/hr/IP, itself bypassable per SEC-02).

**Impact:** An attacker can confirm which email addresses have a registered family account —
a PII exposure (confirms a specific email is linked to a child on this platform).

**Fix:** Return an identical/generic response for "email taken" vs. other failures, or handle
the "continue where you left off" case out-of-band via email instead of in the HTTP response.

---

### SEC-04 — Unbounded, silently-coerced retail checkout quantity
**Severity:** LOW · **Category:** Security · **Effort:** S · **Confidence:** HIGH

**Location:** `app/api/checkout/retail/route.ts:22-23`

**Evidence:** `Number.isInteger(body.quantity) && body.quantity > 0 ? body.quantity : 1` — no
upper bound, and any invalid value (negative, non-integer, missing) silently becomes `1`
instead of being rejected.

**Impact:** Low-severity abuse/DoS vector (large quantities hit the real Stripe API before
Stripe itself would reject them); the silent coercion is also inconsistent with this codebase's
own "fail loudly" principle used elsewhere (webhook, health check).

**Fix:** Cap `quantity` to a sane maximum (e.g. 50) and return 400 above it or for invalid input.

---

### SEC-05 — Customer email + scout token written to logs and the alert webhook
**Severity:** LOW · **Category:** Security · **Effort:** S · **Confidence:** HIGH

**Location:** `app/api/webhooks/stripe/route.ts:42, 87, 92-97`

**Evidence:** `console.log`/`console.error` include the raw customer email and scout token; on
failure both are also POSTed to the external `ALERT_WEBHOOK_URL` (Slack/Discord).

**Impact:** Anyone with server-log or alert-channel access can see customer emails and scout
tokens. Verified in `lib/scout-access.ts:14-18` that a leaked scout token alone cannot be used
as a bearer credential against `/api/scout/state|update` (only the exact demo constant or a
valid session cookie are accepted) — so this is not directly exploitable today, but it widens
blast radius if log/Slack access is ever compromised, and undermines the "never leaves the
server" design intent for the token.

**Fix:** Redact/hash the scout token before logging or alerting; avoid full customer email in
the happy-path `console.log`.

---

### SEC-06 — Demo token's shared record is an unauthenticated public write target
**Severity:** LOW · **Category:** Security · **Effort:** S (if a fix is wanted) · **Confidence:** HIGH

**Location:** `lib/scout-access.ts:14-18`; `lib/scout-store.ts:84-94`

**Evidence:** `resolveScoutAccess` correctly scopes the demo token to only ever return the
shared demo record or a real family's own session-verified scout — verified no other token
value grants cross-family access. But the demo record itself is a single shared,
unauthenticated, internet-writable row: anyone can `POST /api/scout/update` with
`{token: "CAPTAIN-RAY-700", ...}` (rate-limited only to 30/min/IP, itself bypassable per SEC-02).

**Impact:** Low — no real family data is reachable, but the shared demo dashboard used for
stakeholder previews can be griefed/reset by any internet user.

**Fix:** Gate writes to the demo record behind a separate demo-admin secret, or accept as a
low-stakes intentional tradeoff.

---

### SEC-07 — `/api/health` discloses infrastructure fingerprinting details
**Severity:** LOW · **Category:** Security · **Effort:** S · **Confidence:** HIGH

**Location:** `app/api/health/route.ts`; `lib/supabase.ts:39-69`

**Evidence:** Unauthenticated (only a 10/min/IP rate limit), returns which Supabase key type is
configured, the Supabase project host, and confirms table names exist and are reachable.

**Impact:** No key material or row data is exposed, but hands an unauthenticated recon summary
(exact project host, key role, table names) to anyone who requests it.

**Fix:** Require a shared-secret header for the detailed fields, or restrict to Vercel's
internal cron/monitoring.

---

### SEC-08 — Wholesale metadata fields accepted with no validation
**Severity:** LOW · **Category:** Security · **Effort:** S · **Confidence:** MEDIUM

**Location:** `app/api/checkout/wholesale/route.ts:50-61`

**Evidence:** Unlike `email` (regex-validated) and `tierId` (normalized), institution
name/contact/phone/shipping-address fields are placed into Stripe metadata with no type check
or length cap.

**Impact:** Low — this data only surfaces as plain-text Stripe metadata (no
`dangerouslySetInnerHTML` found anywhere in the repo, confirmed by grep), so not an XSS vector
today; oversized values could fail the Stripe API call (metadata has a ~500-char limit).

**Fix:** Trim and cap length for each field, mirroring the pattern already used for `email`.

---

### BUG-07 — Two sequential, non-atomic upserts can leave a half-updated row
**Severity:** LOW · **Category:** Correctness · **Effort:** S · **Confidence:** HIGH

**Location:** `lib/scout-store.ts:266-301`

**Evidence:** The main scout fields and `friends_completed`/`book3_sponsored` are written in two
separate `upsert` calls, not one transaction.

**Impact:** A small, transient window where a concurrent read sees a row with one update applied
but not the other. Compounds BUG-02 but is lower severity on its own since both writes normally
land within milliseconds of each other.

**Fix:** Combine into a single upsert with all columns together.

---

### BUG-08 — Email regex duplicated 3× with an inconsistent rule
**Severity:** LOW · **Category:** Correctness · **Effort:** S · **Confidence:** HIGH

**Location:** `lib/family.ts:23` (requires 2+ char TLD); `lib/mailerlite.ts:4`;
`app/api/checkout/wholesale/route.ts:9` (both accept a 1-char TLD)

**Impact:** Low practical impact, but a real inconsistency — an address like `a@b.c` is rejected
by family registration but accepted by wholesale checkout's own validation.

**Fix:** Export one `isValidEmail`/regex from `lib/family.ts` and reuse it everywhere.

---

### FE-06 — Lightbox modal lacks focus trapping / focus management
**Severity:** LOW · **Category:** Frontend (Accessibility) · **Effort:** S · **Confidence:** HIGH

**Location:** `components/ui/Lightbox.tsx:31-113`

**Evidence:** `role="dialog" aria-modal="true"` is set and Esc/Arrow keys are handled, but Tab/
Shift+Tab aren't intercepted (no focus trap), and there's no focus-in on open or focus-restore
on close.

**Impact:** Keyboard/screen-reader users can tab out of an open modal into the rest of the page,
contradicting the `aria-modal="true"` promise (WCAG 2.4.3 / 2.1.2).

**Fix:** Move focus into the dialog on open, restore it to the trigger on close, add a Tab-cycle
handler while open.

---

### FE-07 — Stale placeholder copy undersells the already-live Stripe checkout
**Severity:** LOW · **Category:** Frontend · **Effort:** S · **Confidence:** HIGH

**Location:** `components/retail/ShippingReturns.tsx:17`

**Evidence:** *"[Placeholder] Payments are processed securely. Card handling is added in
Milestone 2."* — shown on the live storefront next to a real Stripe checkout and a sandbox
test-card notice.

**Impact:** Low direct harm, but confusing/trust-eroding copy on a live page.

**Fix:** Update to "Payments are processed securely via Stripe."

---

### OPS-06 — `.env.example` documents two unused env vars
**Severity:** LOW · **Category:** Code Health · **Effort:** S · **Confidence:** HIGH

**Location:** `.env.example:24` (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`), `.env.example:30`
(`STRIPE_PRICE_ID_RETAIL`)

**Evidence:** Neither is read anywhere in `app`/`lib`/`components` — retail checkout builds
`price_data` inline rather than referencing a pre-created Stripe Price.

**Fix:** Remove both, or note they're for a not-yet-built client-side Stripe Elements flow.

---

### OPS-07 — Unused dead export aliases
**Severity:** LOW · **Category:** Code Health · **Effort:** S · **Confidence:** HIGH

**Location:** `lib/scout-store.ts:375-376` (`getOrCreateScout`, `updateScout`)

**Evidence:** Every real call site uses the `*Async` variants; these sync aliases have no
importers anywhere in the repo.

**Fix:** Remove, or comment why they're kept for a planned future consumer.

---

## 6. Recommended fix plan

**Phase 1 — CRITICAL, before any new feature work:**
- BUG-01 (updateScoutAsync swallows DB errors) — also unblocks a correct fix for BUG-02.
- FE-01 (checkout success false confirmation) — small, isolated, high customer-trust impact.
- TEST-01 (webhook/API route test coverage) — do this alongside BUG-01/FE-01 so the fixes ship
  with regression tests, not after.

**Phase 2 — HIGH:**
- BUG-02 (scout progress race) — depends on BUG-01's return-value change.
- API-01, API-02, FE-02 (success page hang, false invoice claim, silent dashboard zero-state) —
  independent, can be done in any order.
- OPS-01 (CI) — quick win, should exist regardless of what else ships.
- OPS-02 (README) — quick win, no code risk.
- TEST-02 (lib business-logic tests) — pairs naturally with BUG-01/BUG-02 fixes.

**Phase 3 — the rest (MEDIUM then LOW):**
- Security items (SEC-01, SEC-02 first — they're the only MEDIUM-severity security findings)
  before the LOW security items.
- Dead-code cleanup (FE-03, FE-04, OPS-03, OPS-06, OPS-07) can be batched into one low-risk
  cleanup pass.
- OPS-04 (Lulu/IngramSpark) needs the clarification below before fixing.

---

## 7. Not reviewed / needs clarification

- **Is `NEXT_PUBLIC_SITE_URL` actually set in the production Vercel environment?** Determines
  real-world exploitability of SEC-01.
- **Is this app deployed behind anything other than Vercel's own edge?** Affects SEC-02's
  real-world exploitability.
- **Is the shared demo profile (`CAPTAIN-RAY-700`) used live in front of stakeholders?**
  Determines whether SEC-06 is worth fixing now.
- **Is real friend-referral counting (BUG-06) planned for a later milestone**, or was it expected
  to already work? The code comment implies it should already be driven by real logins.
- **Is `PricingCalculator`/`calculateWholesalePrice`/`initiateWholesaleCheckout` intentionally
  kept for a future per-copy pricing mode**, or safe to delete as superseded by the flat
  `SPONSOR_TIERS` model? Affects whether FE-03/FE-04's fix should be "wire it up" or "delete it."
- **Is `ALERT_WEBHOOK_URL` actually configured in the live environment?** Materially changes
  OPS-05's real severity.
- **Which print vendor is actually current — Lulu or IngramSpark?** (OPS-04). Current evidence
  from `PROJECT_REFERENCE.md` points to IngramSpark being correct and Lulu being stale, but this
  should be confirmed rather than assumed.
- **The "Stripe test keys exposed in git history" claim (PROGRESS.md task t09)** could not be
  confirmed by scanning this repository's full git history (all branches) for Stripe key
  patterns — either it refers to history outside this repo (an earlier zip/archive), or the
  history was rewritten since. Worth re-verifying what t09 is actually referring to before
  spending time on key rotation for a risk that may not apply to this specific repo.
- Areas explicitly out of scope for this pass (per each area's report): `.next/` build
  artifacts, `node_modules/`, full `supabase_schema.sql` column-by-column review (only the RLS
  section was verified), and presentational-only components not on a data/auth/money path.

---

_This audit was produced by 4 parallel review passes (security; correctness/scalability;
API-integration/frontend; tests/code-health) plus direct verification of every CRITICAL finding
and cross-checking of overlapping findings against the actual source before being merged into
this document, per `CLAUDE.md` section 12._
