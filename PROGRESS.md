# PROGRESS

_This file is maintained by the quality-kit rules in `CLAUDE.md` (section 9). For the authoritative,
prioritized task list (P0-P3) and acceptance tests, see the live tracker linked from
`NEXT_SESSION_HANDOFF.md` in the parent folder — update that tracker too, not just this file._

## Components

| Component | Status | Notes |
|-----------|--------|-------|
| Retail storefront + checkout (Stripe test mode) | partial | Live, but `/checkout/success` shows a false payment-confirmed message with no payment-status check — AUDIT.md FE-01 (CRITICAL) |
| Institutions sponsorship page ($40/$200/$400) | partial | Live; success copy falsely claims an invoice/confirmation email was sent (AUDIT.md API-02); Premium-tier shipping address not enforced server-side (API-03) |
| MailerLite buyer sync | partial | Live, but fires twice per order with no idempotency guard (AUDIT.md BUG-03) |
| Sticker badges (19 real PNGs) + sticker sheet PDF | done | Slot #19 has a checkerboard artifact baked in; waiting on Ray's corrected file |
| Supabase persistence | done | Fixed Sept 22 — production had no Supabase URL / placeholder key since Sept 14 hardening; `/api/health` now writes and reads back to catch stale-cache regressions |
| Family accounts (`/start`, per-family dashboard, session cookies, sponsor-by-share-code) | done | Live-tested Sept 22 |
| Dashboard fixes (no pre-filled address, no false dispatch status, correct 700-point copy) | done | |
| Order logging + Stripe webhook failure alerts | partial | Paid test order saved, webhook delivered, `pending_webhooks: 0` — but `updateScoutAsync` swallows DB write failures and the webhook can mark an order "fulfilled" when the unlock silently failed to save (AUDIT.md BUG-01, CRITICAL) |
| Domain `puenpublishing.com` -> Vercel | done | Live 2026-09-25; `/api/health` green on the domain (tracker t25) |
| Five printed video pages (`/v1`–`/v5`) + `videos` table | done (code) | Pending + live states, 5 QR codes made and decoded. **Migration `supabase/migrations/20260925_create_videos.sql` must be run in the Supabase SQL editor**; until it is, every page falls back to the waiting screen and `/api/health` reports `videosTable` as failing |
| Resend email service + login link (2nd device) | planned | Tracker t32 — depends on domain |
| Chief Explorer naming on completion banner + sticker sheet | planned | Tracker t11 |
| Parent's Guide funnel ($29.97 digital, $10 Patrol, gift QR codes, gift registration, approval gate) | planned | Tracker t12-t15 |
| Real friend tracking (2 of 3 -> 300 pts) | planned | Tracker t16 |
| MailerLite lifecycle emails | planned | Tracker t17 |
| Ray's admin view | planned | Tracker t18 |
| Rotate Stripe keys exposed in git history | planned | Tracker t09 |
| Deliver $270 Fiverr order | planned | Tracker t26 — due Oct 4, 2026 |
| CI pipeline (lint/typecheck/test on push) | planned | AUDIT.md OPS-01 (HIGH) — currently only a gitignored local hook enforces this |
| API-route test coverage (incl. Stripe webhook) | planned | AUDIT.md TEST-01 (CRITICAL) — 0 of 12 routes tested |
| README.md accuracy rewrite | planned | AUDIT.md OPS-02 (HIGH) — still describes a stale "Milestone 1, stub checkout" state |

## Known issues

- **See `AUDIT.md`** (full read-only audit, 2026-09-23) for the complete, evidence-backed issue
  register — originally 3 CRITICAL, 7 HIGH, 15 MEDIUM, 12 LOW. **All 3 CRITICAL are now fixed**
  (plus BUG-02, BUG-03, BUG-07, API-02); `FIX_PLAN.md` holds the chosen approach and the risks
  each fix carries. The remaining HIGH items are OPS-01 (no CI), OPS-02 (stale README) and the
  rest of the test-coverage work.
- **Stickers: 19 new files received from Ray 2026-09-23 but NOT wired in** — two blockers, both
  needing the client: badges 18/19 now read Generosity/Integrity where the site says
  Integrity/Stewardship, and all 19 were delivered opaque (no alpha channel) where the current
  live badges are transparent. Details and a draft reply are in
  `../RAY_CLIENT_COMMUNICATION_LOG.md`. Files are at
  `D:\fiverr client\Ray puens work\xiankim7-attachments (3) new\`.
- Sticker slot #19 has a checkerboard pattern baked into the source file; a cleaned temporary
  copy is live but the real fix needs Ray's corrected asset (see `RAY_CLIENT_COMMUNICATION_LOG.md`
  — client says it's fixed on their end but only sent a screenshot, not the actual files, as of
  2026-09-23).
- Store still shows placeholder cover/interior images pending Ray's high-res files.

## Tech debt log

- ~~**BUG-01 (CRITICAL):** `updateScoutAsync` swallowed database write failures.~~ **Fixed
  2026-09-23** — it now returns `{ state, persisted, error }` and all three callers act on it.
- ~~**FE-01 (CRITICAL):** `/checkout/success` claimed payment succeeded without checking.~~
  **Fixed 2026-09-23** — three honest states driven by Stripe's `payment_status`.
- **TEST-01 (CRITICAL): partially addressed.** 17 new tests cover the scout store (including the
  concurrency and failure paths) and the checkout confirmation logic, and were mutation-tested to
  prove they fail when the fix is reverted. Route-level tests for the Stripe webhook are still
  missing.
- Stripe test keys were claimed at some point to be committed to git history (t09) — **could not
  be confirmed** in this repo's actual git history during the 2026-09-23 audit (see AUDIT.md
  section 7); worth re-checking what t09 actually refers to before spending time on rotation.
- See `AUDIT.md` section 4 (issue register) for the remaining 32 MEDIUM/HIGH/LOW items.

## Phase 1 remediation (2026-09-23)

Fixed and verified — `npm run lint`, `npx tsc --noEmit`, `npm test` (45 tests, up from 28) and
`npm run build` all pass, plus browser verification of both UI fixes:

| Issue | Change |
|---|---|
| BUG-01 | `updateScoutAsync` returns `{ state, persisted, error? }`; the webhook no longer marks an order fulfilled on a failed unlock (and returns 500 so Stripe retries), `/api/scout/update` returns 503 instead of a false success, and sponsor-confirm reports `unlockPending` + alerts rather than lying in either direction |
| BUG-02 / BUG-07 | Optimistic concurrency on `updated_at` with re-read-and-re-merge, max 3 attempts; the two old upserts merged into one write with a 42703 fallback for un-migrated databases |
| FE-01 | `/checkout/success` now renders paid / unpaid / unknown from Stripe's `payment_status`; fulfilment promises appear only when payment is confirmed |
| FE-02 | Dashboard has an explicit error state with retry instead of falling through to zeroed defaults, and rolls back an optimistic sticker toggle that was not saved |
| API-02 | Removed the false "a confirmation email and invoice have been dispatched" claim |
| BUG-03 | Removed the duplicate MailerLite sync from the success page (it re-fired on every reload) |
| API-01 (part) | Stripe SDK given an 8s timeout + 1 retry so a slow Stripe cannot hang a paid customer's page |

Verified in the browser: `/checkout/success` with no session and with a junk `session_id` both
show the neutral state; the dashboard shows the retry panel on a real 429 (rate limit exhausted
deliberately) and recovers when "Try again" is pressed.

## Phase 2 (2026-09-23, same day)

| Item | Change |
|---|---|
| Stickers | All 19 of the illustrator's final badges are live at 900×900 (were 600×600). Badge 19's checkerboard is gone. The artwork renamed two virtues, so `lib/stickers.ts` was updated to match: **18 = Generosity, 19 = Integrity**; "Stewardship" no longer exists in the codebase. The delivered files were opaque RGB despite being described as transparent, so the backgrounds were removed on our side (flood fill inward from the border + 1px feather). Verified in-browser over a red canvas: corners fully transparent, no white halo. **Still worth asking Aymen for genuinely transparent exports for the print files.** |
| Next.js | Upgraded 14.2.15 → **14.2.35** (same major, non-breaking). Clears the RCE-class advisories; the rest of the 14.x advisories are DoS-class and mostly not applicable (no rewrites, no middleware, no server actions, hosted on Vercel not self-hosted/Windows). |
| Invoicing (API-02) | Stripe `invoice_creation` enabled on the wholesale session, so institutional sponsors get a real itemised invoice for their accounting. **Before launch: confirm "Email finalized invoices" is ON in the Stripe dashboard (Settings → Billing → Invoices)** — otherwise the success-page wording overstates what happens. |
| Dead code (FE-03/FE-04/OPS-06/OPS-07) | Removed `PricingCalculator.tsx`, the whole per-copy pricing model from `lib/pricing.ts`, `initiateWholesaleCheckout` + its unused payload types, the two unused scout-store aliases, and two unused `.env.example` vars. Its 19 tests tested code no page used — replaced with tests of `SPONSOR_TIERS`, the amounts institutions are actually charged (closing part of TEST-02). |

## Phase 3 (2026-09-25) — the five printed video pages

Ray is printing five video links inside Book 1 before the videos themselves exist, so the
addresses must be frozen now and the content swapped later.

| Item | Change |
|---|---|
| Addresses | `puenpublishing.com/v1` … `/v5`, as five thin routes (`app/v1/page.tsx` …). Deliberately **not** one dynamic route at the site root: a root catch-all would swallow every mistyped URL and remove the 404 page. Each file is 20 lines and exports `dynamic = "force-dynamic"`, which is what makes "edit the row, it is live" true rather than serving a build-time snapshot. |
| Data | `public.videos` (`supabase/migrations/20260925_create_videos.sql`): slug, title, provider, video_id, status. `provider` + `video_id` are stored separately, never a full URL, so changing host later is a two-field edit. Seeded with all five rows as `pending`. |
| Never a dead link | Every failure path resolves to the waiting screen: no row, table missing (migration not yet applied), Supabase unconfigured, a 4s query timeout, a malformed id, an unknown provider. A printed address can never 404 and never shows an error. |
| Embed, never redirect | The live state renders an iframe (`youtube-nocookie`, Cloudflare Stream, Bunny Stream or Vimeo), so a child stays on our page instead of being sent to YouTube's recommendations. Ids are validated against each host's own format before they reach an `iframe src`. |
| Tests | 50 new tests (`lib/videos.test.ts`, `components/video/VideoPage.test.tsx`), 92 in total. `vitest.config.ts` now also picks up `components/**/*.test.tsx`. Nine mutations were applied and all nine were caught, including "link out instead of embedding" and "stop validating the video id". |
| Print | Five QR codes at `../Puen_Delivery_2026-09-25/QR/videos/` (print SVG + 1000px/2000px PNG each, version 4, ECC H, 4-module quiet zone). All ten PNGs were decoded again afterwards and each carries its own address. |

**Open, and needed before this is truly finished:** the migration has to be run in the Supabase
SQL editor (nothing in this repo can apply DDL), and Ray still owes us which four pages carry the
links and one line on each video's subject. Video hosting is unbought — the fallback is a YouTube
unlisted video, which the printed link makes reversible later.

## Last session summary

2026-09-23: Read `NEXT_SESSION_HANDOFF.md`; installed the Claude Code quality kit (`CLAUDE.md`,
`.claude/settings.json`, hooks, `/setup` `/audit` `/fix-audit` `/next` `/qa` commands,
`code-auditor` and `qa-reviewer` subagent instructions) into this project per the user's request,
so future sessions enforce lint/typecheck/test gates automatically on edit, commit, and turn-end.
`typecheck` script was added to `package.json` to support this. Then ran the full `/audit`:
4 parallel review passes (security; correctness/scalability; API-integration/frontend;
tests/code-health) against the actual codebase, verified every CRITICAL finding by reading the
cited code directly, merged overlapping findings, and wrote `AUDIT.md`. No code was changed —
audit was read-only per `CLAUDE.md` section 12. Also committed `CLAUDE.md`/`ARCHITECTURE.md`/
`PROGRESS.md` to git, and created `RAY_CLIENT_COMMUNICATION_LOG.md` (parent folder) to track
client communication.
