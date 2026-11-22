# Character Vote Campaign: local build and verification

Date: 22 November 2026. Branch: `feat/character-vote-campaign`.

## Implemented

- Evergreen Welcome Video and five-character adult vote form, optional answer,
  separate contact permissions, canonical source tags and unchanged-request retries.
- Immutable vote persistence, atomic reservation/outbox writes, signed private
  receipts, fixed private kit path and short-lived storage URLs.
- Approved personalized confirmation and backup email, private emailed PDF opener,
  server-selected reservation versus existing NC purchase link.
- Bounded leased delivery worker with backoff, provider idempotency, retained
  failure state and authenticated owner retry for eligible unsent work.
- Protected owner statistics, cursor-paged contact/reservation records and
  formula-safe current-page CSV exports.
- Six-page kit assembly from canonical matching Guide entries and supplied art.
- Six source-specific QR pairs generated outside the repository and decoded
  against their intended URLs. They require production deployment before use.

## Evidence

- Original baseline: 980 tests passed across 90 files.
- Latest full suite: 1,125 tests passed across 103 files, exit 0.
- `npx.cmd tsc --noEmit`: exit 0.
- `npm.cmd run lint`: exit 0. Existing `Lightbox.test.tsx` image warning remains;
  no rule was weakened or test skipped.
- 59 deliberate mutations across domain, persistence, delivery/routes, parent UI,
  owner UI/API and actual PDF generation returned nonzero. Every restored run
  returned zero; each group's new cases were observed failing under mutation.
- A separate read-only QA agent reviewed every component and independently ran
  targeted tests. Findings fixed: malformed Unicode acceptance, expired welcome
  emails, missing receipt recovery, withdrawn-message retries and weak PDF tests.
- PDF: six Letter pages, matching Purpose/Fairness/Sincerity activities, 300 DPI
  source coloring renders, one drawn image per page, Guide content and bounds
  checked. Current badges are black and white. Larger-type revision rendered and
  inspected locally; actual home-printer proof remains pending.

Commands use `--minWorkers=1 --maxWorkers=2` to avoid the machine's worker minimum
conflict. No dependencies or framework versions were changed. Existing unrelated
worktree files and the separately modified Vitest worker configuration were not
included in campaign commits.

## Deliberately unclaimed

No production push, migration, storage upload, customer email, scheduler
registration or real payment was performed. No production build was run.

A later user-authorized Playwright pass completed 24 checks with no page errors:
real YouTube playback, validation/focus, separate consent, busy/retry behavior,
network failure, missing/forged private links, phone widths 375/320, keyboard radio
selection, malformed API rejection and unauthenticated admin API rejection.
Success confirmation, download failure, reservation and live-order UI branches
were checked using clearly labelled browser API fixtures. These do not prove
actual storage, database writes or provider delivery. A 64-second captioned MP4
and JSON results are in the private delivery folder's Browser_QA evidence.

The Welcome iframe now uses strict-origin-when-cross-origin to identify the site
to YouTube. Its first request was observed with origin-only Referer, and actual
video currentTime advanced while paused was false. Global page/private-receipt
no-referrer policies remain intact. The rendered-page regression test failed
with the entire iframe fix removed (exit 1), then passed after exact byte restore
(exit 0). Other embedded players already used the working iframe policy.

Use http://localhost:3000/welcome for this local Next instance. Requests from the
127.0.0.1 alias fail its strict origin comparison because Next constructs the
canonical request URL using localhost. The policy was not weakened. Deployment
must verify the canonical public hostname and origin handling in staging.

Before release, follow campaign-launch.md: execute SQL acceptance and genuine
concurrency/permission checks in staging; upload and verify the approved private
kit and URL expiry; configure secrets and an active scheduler; exercise actual
provider delivery/recovery; verify supported devices and playback in staging; approve final character
portraits/color badges and a print proof. Campaign health checks configuration,
schema and file readiness, not inbox delivery or scheduler registration.

The local delivery folder is `Campaign_Delivery_2026-11-22` outside this public repo.
It contains the kit PDF, rendered previews, PDF and QR verification JSON, tagged
QR PNG/SVG pairs and per-group mutation evidence. No private transcript, full book
or client commercial ledger was committed.

## Follow-up integration work

Real local PostgreSQL 17.12: nineteen verification groups passed, including
migration/acceptance rollback, exhaustive public-role RPC denials, service-role
RLS behavior, actual concurrent submission/email/reservation/worker sessions,
lease replacement, exhausted/withdrawn jobs and admin summary totals. Three SQL
mutants failed; restored runs passed with exact bytes restored. Evidence is in
Campaign_Delivery_2026-11-22/Database_QA. Hosted Supabase REST/storage/provider
checks still require connected Supabase and Vercel accounts.

GitHub credential verification succeeded with repository push permission. Vercel
CLI reports logged out, and the Supabase/Vercel integrations are not confirmed
connected. An approved test inbox is recorded privately outside this repository;
no real email was sent. Final portraits/colour badges were not found in supplied
files. Seven NC print destinations and QR files are separate from the six
campaign source codes; see nc-qr-spec.md. The Club page truthfully discloses that
NC club accounts/referral rewards are pending. No free Book2 reward is claimed.
