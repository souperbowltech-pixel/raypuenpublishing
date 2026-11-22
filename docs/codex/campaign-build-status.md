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
- Final full suite: 1,120 tests passed across 101 files, exit 0.
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
registration or real payment was performed. No full browser viewport check or
production build was run, per local server/build restrictions. DOM tests exercise
interaction logic but do not prove phone layout.

Before release, follow campaign-launch.md: execute SQL acceptance and genuine
concurrency/permission checks in staging; upload and verify the approved private
kit and URL expiry; configure secrets and an active scheduler; exercise actual
provider delivery/recovery; check phone/keyboard layouts; approve final character
portraits/color badges and a print proof. Campaign health checks configuration,
schema and file readiness, not inbox delivery or scheduler registration.

The local delivery folder is `Campaign_Delivery_2026-11-22` outside this public repo.
It contains the kit PDF, rendered previews, PDF and QR verification JSON, tagged
QR PNG/SVG pairs and per-group mutation evidence. No private transcript, full book
or client commercial ledger was committed.
