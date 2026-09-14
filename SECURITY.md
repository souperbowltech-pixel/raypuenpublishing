# Security Findings & Hardening — Puen Publishing / Regency Press

This document records the security review of the storefront, checkout, webhook,
Supabase-backed scout gamification, and email-sync surfaces, the fixes applied,
and the **manual actions the operator must still perform**.

Severity legend: **C** = Critical, **H** = High, **M** = Medium.

---

## Findings & Fixes Applied

### C1 — Stripe webhook accepted UNSIGNED events
- **File:** `app/api/webhooks/stripe/route.ts`
- **Risk:** When `STRIPE_WEBHOOK_SECRET` or the `stripe-signature` header was
  missing, the handler fell back to `JSON.parse(body)` and trusted it. Anyone
  could POST a forged `checkout.session.completed` event to inject arbitrary
  emails into MailerLite and (once wired) trigger free Lulu print dispatches.
- **Fix:** The signing secret is now required (missing → `500`), the signature
  header is required (missing → `400`), and events are accepted only via
  `stripe.webhooks.constructEvent(...)` (failure → `400`). The `JSON.parse`
  fallback was removed entirely.

### C2 — Gamification score could be forged by anyone
- **Files:** `app/api/scout/update/route.ts`, `lib/scout-store.ts`,
  `lib/gamification.ts`, `components/dashboard/ComprehensionQuiz.tsx`,
  `app/dashboard/book2/page.tsx`
- **Risk:** `/api/scout/update` had no auth and did `{ ...current, ...body }`
  (mass assignment). A client could POST `{ token, quizScore: 400,
  referralScore: 300, status: "Unlock_Volume_3" }` for any token and instantly
  unlock Volume 3 (and any free print tied to it).
- **Fix:**
  - Quiz grading moved server-side (`gradeQuiz` in `lib/gamification.ts`); the
    client submits only raw answers.
  - `/api/scout/update` rewritten with a strict whitelist: it accepts only
    `scoutName` (sanitized), `completedPages` (unique ints 1..19), and
    `quizAnswers` + `quizBook` (graded to a `quizScore`). It **never** accepts
    `quizScore`, `referralScore`, `totalScore`, or `status` from the client.
    The referral demo flag is honoured only when `ALLOW_DEMO_REFERRAL=true`.
  - Defense-in-depth added in `lib/scout-store.ts`: both `updateScoutAsync` and
    `updateScoutLocal` force the token, clamp `quizScore` to `[0,400]` and
    `referralScore` to `[0,300]`, sanitize `completedPages`, and recompute
    `totalScore`/`hasPassedQuiz`/`hasRecruitedFriend`/`status`.

### H1 — Supabase anon key could write ANY row
- **Files:** `supabase_schema.sql`, `lib/supabase.ts`
- **Risk:** RLS policies allowed public `INSERT`/`UPDATE`/`SELECT` with
  `WITH CHECK (true)`. Since the anon key ships to the browser, anyone could
  read or forge any scout row directly, bypassing the API.
- **Fix:** The public policies were removed so RLS is **default-deny** for the
  anon key. All reads/writes go through server API routes using the Supabase
  **service-role** key (which bypasses RLS). `lib/supabase.ts` no longer
  hardcodes the project URL, reads the URL from `SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_URL`, and prefers `SUPABASE_SERVICE_ROLE_KEY` over the
  anon key (exporting a `usingServiceRole` flag).

### H2 — Live credentials committed to a public repo
- **File:** `PROJECT_STATUS_AND_HANDOVER_REPORT.md`
- **Risk:** The handover report listed the live Lulu client key/secret, the
  Supabase project URL, and Stripe account/keys in a public repository.
- **Fix:** All such values were redacted from the current report and an
  **ACTION REQUIRED** rotation note was added. Note that redaction does **not**
  remove the values from git history — see the required actions below.

### M1 — No rate limiting
- **Files:** `lib/rate-limit.ts` (new), `app/api/scout/update/route.ts`,
  `app/api/scout/state/route.ts`, `app/api/checkout/retail/route.ts`,
  `app/api/checkout/wholesale/route.ts`
- **Fix:** Added an in-memory token-bucket limiter and applied it: scout update
  30/min/IP, scout state 60/min/IP, retail & wholesale checkout 10/min/IP each.
  On limit, routes return `429` with a `Retry-After` header. **Note:** the
  limiter is per-instance; production should back it with Upstash/Vercel KV for
  a shared limit.

### M2 — Unbounded `completed_pages` array
- **Fix:** Covered by the C2 sanitisation — `completedPages` is coerced to a
  unique, sorted set of integers in the range 1..19 in both the API route and
  the store.

### M3 — Internal error messages leaked to clients
- **Files:** `app/api/checkout/retail/route.ts`,
  `app/api/checkout/wholesale/route.ts`
- **Fix:** Real errors are logged server-side; clients now receive a generic
  message (no `error.message`).

### M4 — Missing input validation on checkout/state endpoints
- **Files:** `app/api/checkout/wholesale/route.ts`, `app/api/scout/state/route.ts`
- **Fix:** The wholesale route validates the contact email (regex, `400` on
  invalid), normalizes `tierId` to `1|2|3` (default `1`), and uses the validated
  email as `customer_email`. The scout-state route validates the token against
  `/^[A-Za-z0-9_-]{3,64}$/` and sanitizes the optional `name` param. MailerLite
  sync (`lib/mailerlite.ts`) also validates the email before calling the API.

---

## ⚠️ Required Manual Actions (Operator)

1. **Rotate all exposed credentials.** They were committed to git history, and
   redaction does not remove history:
   - Lulu `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET`
   - Stripe secret key (`STRIPE_SECRET_KEY`)
   - Supabase service-role key and anon key
2. **Configure Vercel environment variables:** set `STRIPE_WEBHOOK_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_URL`, and register the Stripe
   webhook endpoint `/api/webhooks/stripe` in the Stripe dashboard so the
   signing secret matches.
3. **Apply the new RLS:** run the updated `supabase_schema.sql` in Supabase to
   drop the permissive public policies and enforce default-deny for the anon key.

---

## Follow-ups (not yet addressed)

- **Shared token:** all scouts currently share one token (`CAPTAIN-RAY-700`) in
  `app/dashboard/book2/page.tsx`. Generate unique per-scout tokens so scouts
  cannot read/modify each other's records.
- **Real referral verification:** replace the `ALLOW_DEMO_REFERRAL` demo flag
  with genuine referral verification (e.g. a verified friend order) before the
  300-point award counts toward the Volume 3 unlock.
- **Quiz answer key on the client:** the correct answers are shipped to the
  browser. This is acceptable now that grading is server-side, but note it if
  the quiz is ever used for anything higher-stakes.
- **Children's PII:** `scout_name` may be children's PII. Keep it out of any
  public read path and consider minimizing/anonymizing what is stored.
