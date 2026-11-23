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
conflict. No npm runtime dependencies or framework versions were changed. Browser QA
uses a pinned Python development requirement. Existing unrelated
worktree files and the separately modified Vitest worker configuration were not
included in campaign commits.

## Deliberately unclaimed

No production push, hosted migration, storage upload, customer email, scheduler
registration or real payment was performed. No local production build was run.
Vercel built a protected preview after the feature branch was pushed.

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

## 23 November: verified browser CI and protected preview

GitHub Actions run 45055572899 completed successfully:
https://github.com/souperbowltech-pixel/raypuenpublishing/actions/runs/45055572899

Thirteen server-rendered browser checks passed: seven NC routes, four viewport
widths, 200% text and an actual unknown-route 404. External media was deliberately
blocked and JavaScript disabled in this geometry pass; it does not prove media
playback or client-side campaign persistence. The entire header fix was removed:
the expected enlarged-text overflow at 768px failed with exit 1, then restoration
passed with exit 0. Removing the player width caused the expected horizontal
overflow at 320px, also exit 1/restored0. The proof runner rejects infrastructure
failures as a substitute for either specific regression. Artifact screenshots
were downloaded and inspected locally.

Preview deployment succeeded for commit f38d174. Its address is:
https://raypuenpublishing-89giyvwkh-souperbowltech-pixel.vercel.app

Unauthenticated requests redirect to Vercel sign-in. A final HTTP200 on that login
page is not application verification. Production remains on its earlier commit;
print destinations are not activated on the canonical public domain. Hosted
backend/storage/email/scheduler work still requires Supabase/Vercel connections.

## Full media acceptance: external provider blocker

The separate full playback run45107452925 failed at the Welcome player:
https://github.com/souperbowltech-pixel/raypuenpublishing/actions/runs/45107452925

The captured screenshot shows YouTube's "Sign in to confirm you're not a bot"
challenge on the GitHub runner. Playback remained at0, paused=true, readyState0.
This is recorded as a failed external-media gate, not passed or silently skipped.
No challenge bypass was attempted. Verify all five films in an ordinary approved
browser/phone before release. The thirteen-check geometry job remains separately
successful; it deliberately blocks media and cannot substitute for this gate.

GitHub repository and Preview/Production environment secret-name listings were
checked: no service credentials are stored there. Supabase/Vercel account-owner
connection remains required for hosted operations. No secret values were read.

## Local normal-network media probe completed

After the cloud provider challenge, an isolated lightweight HTTP/iframe probe
was run on the owner's ordinary local network with the Next server stopped.
All five public NC video IDs advanced past0.5 seconds with paused=false and
readyState4, each after one real play gesture. Screenshots of the last two clips
were inspected and show the NC cast. No authentication challenge was bypassed.

This proves actual starts for all five clips in standalone embeds. It does not
claim a full-duration watch, hosted Next page media acceptance or campaign
persistence. Keep that evidence separate from the thirteen route/geometry checks
and the failed GitHub full-media run. Protected preview and hosted backend gates
still require the connected accounts.
