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
| Resend email service + login link (2nd device) | email done, login link planned | Resend live on `send.puenpublishing.com` since Oct (DKIM verified in DNS 2026-11-12); login link still planned |
| Chief Explorer naming on completion banner + sticker sheet | planned | Tracker t11 |
| Parent's Guide funnel ($29.97 digital, $10 Patrol, gift QR codes, gift registration, approval gate) | planned | Tracker t12-t15 |
| Real friend tracking (2 of 3 -> 300 pts) | planned | Tracker t16 |
| MailerLite lifecycle emails | planned | Tracker t17 |
| Ray's admin view | planned | Tracker t18 |
| GSAP pass (from the Sheryians design videos) | in progress (3 of 4) | Huzaifah approved GSAP on 14 Nov, every version kept: tag before-gsap marks the site before it, and each part gets its own commit and tag (gsap-1 ...). 1: hero title words rise (done). 2: book cover turns and lifts with scroll (done). 3: virtues marquee (done). 4: numbers count up. Lenis, custom cursor, loader and image sequences were left out on purpose (phone scrolling, no cursor on touch, Doherty, no frame assets) |
| Motion and usability pass (animation principles, Fitts, Hick, Miller, Doherty, Jakob) | done (5 of 5) | Our own initiative, not billed. 1: tokens, press, lift, Reveal, Spinner (done). 2: 44 px tap targets, spinners in busy buttons and waiting screens (done). 3: reward moments on kid pages (done). 4: entrances, card depth, Lightbox (done). 5: forms, Tesler's law (done) (Huzaifah confirmed 14 Nov that "Haskell's law" meant Tesler's). Library parts 3 and 4 paused until Ray sends the final NC book |
| Private library: review copies with one-time codes, paid digital Guide delivery | in progress (2 of 5 done) | Ray asked 13 Nov. 1: codes, name cleaning, stamping (done). 2: bucket, table, /library page and /api/library/open (done; migration `20261114_create_library.sql` not yet run). 3: admin codes. 4: webhook delivery of the $29.97 Guide. 5: reading editions (script done; NC 10.7 MB, Geezy 14.3 MB). Needs `LIBRARY_CODE_SECRET` (32+ chars) in Vercel |
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

**2026-11-14: GSAP part 3 of 4 (virtue strip).** `components/motion/VirtueMarquee.tsx` adds a strip of the 19 virtue badges from `lib/stickers.ts` under the storefront hero, gliding left in an endless loop (GSAP, xPercent -50 over 45 s, about 76 px a second). It is a new section on the storefront, built only from existing book content. The list is rendered twice once moving, the second copy hidden from screen readers, and the track has no padding so -50% is exactly one copy (measured 6857 px = 2 x 3428.6). A Pause / Play button (aria-pressed, 44 px) meets WCAG 2.2.2; the strip also rests under a mouse (not a finger tap, which would freeze it while the button still said Pause) and while it is scrolled out of view. The header row keeps the button's height from the server render, so the button's arrival moves nothing (section 150 px before and after, measured). Before script, or if GSAP fails, it is one row that scrolls sideways and is a named region the keyboard can scroll. For reduced motion the list wraps so all 19 show without scrolling (390 px phone: 0 off screen, section 766 px tall; 1280 px: 262 px). Checked on the running site at 1280 and 390 px: moving, pause holds, no horizontal page overflow, no console problems. Known, minor: under reduced motion the wrapped list keeps a focusable region that has nothing to scroll; if GSAP fails on desktop the still row hides its scrollbar; the reduced-motion list is tall on a phone. Seen in passing, not changed: at 390 px the sticky header wraps "Regency Press • Puen Publishing" onto two lines. Videos: `demo-videos/gsap-3-*.webm`.

**2026-11-14: GSAP part 2 of 4 (cover scroll).** `components/motion/CoverParallax.tsx` ties a small lift (yPercent -12) and turn (-4 deg) of the storefront cover to scrolling past the hero (ScrollTrigger, scrub 0.6), loaded through `loadScrollGsap` in `components/motion/load-gsap.ts`. Nothing waits or hides: the cover sits still until GSAP arrives, and stays still for reduced motion or if GSAP fails (a console warning). Only the wrapper moves, so the cover's own tilt is kept. Checked on the running site: at 0 / 200 / 450 px scroll the wrapper moves 0 / -8.6 / -24.5 px and turns up to about 2 deg on desktop (0 / -4.9 / -14 px on a 390 px phone), none for reduced motion, no horizontal overflow, no console problems. Videos: `demo-videos/gsap-1-*.webm`, `demo-videos/gsap-2-*.webm`.

**2026-11-14: GSAP part 1 of 4 (hero title).** gsap 3.13.0 added (exact version) and loaded only when the storefront title animates, by dynamic import. `components/motion/HeroTitle.tsx` renders each word as its own span from the server and raises them one after another (yPercent 110 to 0, stagger 0.08 s). A tiny inline script in `app/layout.tsx` marks `html.js` before first paint so the words can wait unseen without a flash; without script nothing is hidden, and a CSS fallback shows them after 1.5 s if GSAP never arrives. Reduced motion shows the title at once and never downloads GSAP. Screen readers read the whole title from aria-label. GSAP is fetched through `components/motion/load-gsap.ts`; if it arrives after MOTION_FALLBACK_MS (1.5 s, the same number as the CSS fallback) the title is left shown instead of hidden and raised twice. Checked on a production build (next start) with Playwright: words hidden at DOM ready, the first word rising from 107% at 219 ms and settled by 1.4 s, gaps between words 10 px at 1280 px and 8 px at 375 px, no horizontal overflow, reduced motion shows the title at once, no console errors. Storefront first load 107 kB; GSAP is a separate chunk.

**2026-11-14: motion pass, part 5 of 5 (forms: Tesler, Miller, Hick, Jakob).** Tesler: the site now carries the fiddly parts. Every label on the wholesale and Patrol claim forms focuses its own field; the browser can autofill organisation, name, email, phone and the address; ZIP boxes open the number pad; state boxes capitalise when left; the Patrol access box takes the whole receipt link, a link without https, the link inside a sentence or email, or the bare token (`lib/patrol-link.ts`); it now looks the Patrol up only when the button is pressed (it used to on every keystroke, which could hit the 30 per minute lookup limit) and says when no Patrol matches or the limit is reached, instead of a spinner that never ends. Miller: the wholesale form was already two groups of four; the Patrol claim now puts the address in its own labelled fieldset of four, apart from the name. Hick: checked, no change: each card already has a single primary action, and the Guide's two plans are the choice itself. Jakob: the shared header already keeps the logo top left linking home and Buy Now top right. Checked in a 375 px browser on /institutions: label clicks focus their fields, typing 'ca' gives 'CA', the ZIP box has inputmode numeric, no page errors.

**2026-11-14: motion pass, part 4 of 5 (entrances and depth).** Below-the-fold groups on the storefront (gallery, book details, author card, shipping cards), the Guide pricing cards and the wholesale tiers now enter together with a short stagger through `Reveal`, which can render as a list so the gallery stays a `ul`. Hover depth (`.lift`) is used only on things you can click (gallery tiles, wholesale tier cards): a lift on a plain card would suggest a click that does nothing (Jakob's law), so the plan's "covers and pricing cards" became "clickable cards". The Lightbox backdrop fades in and the picture grows in when it opens; paging keeps the same element so a slow next picture never shows as an empty box. Known: hovering a tier card in the ~1 s while it enters moves it without easing. Checked against the running site with Playwright at 1280 px: four groups wait as pending, the third gallery tile is mid-entrance with a 140 ms delay, the state is gone after it settles, a full scroll leaves nothing hidden, the dialog runs fade-in and the figure fade-scale, no page errors. A demo video of parts 1 to 3 is at `demo-videos/motion-parts-1-3.webm` (local only, excluded from git).

**2026-11-14: motion pass, part 3 of 5 (reward moments).** Celebrations play when the child earns them, on the thing that changed, and stay still on a later visit: `components/ui/useJustBecameTrue.ts` takes its baseline from the first loaded render, so an unlock from last week opens quietly. Quiz: while the save is on its way it shows only "Checking your answers…" (no stale score, no Retake); once saved, right answers pop one after another, a wrong pick shakes, a perfect score pops with the emoji wiggling. Score gate: the medal dips and springs up when the pass lands, unless the same answer also unlocks Book 2, where the unlock card carries the fanfare alone. Unlock card: badge stamps in and heading pops when the unlock happened on this visit; the dispatched order rises with a bouncing emoji. Stickers: only the badge just ticked stamps in. Copy confirmations pop; the Patrol claim answer rises when it arrives; checkout success tick, gift thank-you and library download notice animate on their own screens. Checked in the browser: ticking a demo sticker plays `stamp 0.6s` on that badge alone. The Patrol milestone (3 families) is not animated, because it is always first seen on a page load. Dispatch and download news reach screen readers through a status region mounted in advance. Known: the checkout success tick pops on every load of that URL (it is the landing after payment); no page-level test drives a save that flips an unlock (hook and card are tested separately).

**2026-11-14: motion pass, part 2 of 5 (Fitts and Doherty).** Controls found under 44 px are now at least 44 px: quantity steppers, sticker and tier buttons, the sticker sheet and ribbon buttons, the quiz switcher and Retake, demo controls, dismiss and sign-out, the guardian checkbox row, header and page logos, every back link, gift and captain link copy, the cancelled checkout link and the Patrol link on the success page. Sticker toggles carry aria-pressed and a name per page; tier buttons are named by tier and price. Every button that waits on the network shows the shared Spinner, and every waiting screen (/start loading and checking, Explorer dashboard, Patrol hub, gift confirming) shows one with role=status. Sign out on the Explorer dashboard now waits for the server, times out after 10 s and says so if it fails, instead of an unhandled error. Tests read each control's own class list (order free) on rendered markup where a component renders alone, and click real busy buttons in jsdom. Measured in the browser at 375 px on the demo dashboard and /; other pages rest on the tests (the dev server ran out of memory). Known gap: admin Approve and Decline are plain form posts with no busy state; a double click can post twice (admin only). Tech debt: the busy states of WholesaleForm, StartForm and BookUnlockCard are guarded only in source (LibraryForm and GrandpaSponsorCard are click-tested in jsdom); status regions appear together with their text, so some screen readers may not announce them. The certificate download is a plain file link, so the browser download bar is its feedback.

**2026-11-14: motion pass, part 1 of 5 (foundation).** Tailwind now has motion tokens: `out-soft` and `spring` easing, 120/320/600 ms durations, and keyframes `pop-in`, `boing`, `wiggle`, `shake`, `stamp` and `rise`, all written as key poses with overshoot so things settle, and all moving only transform and opacity. Both button classes squash on press. `.lift` raises a card on hover only where a real pointer hovers. `components/ui/Reveal.tsx` brings a group in with a stagger, but only a group that starts below the fold, and only after hydration, so nothing is hidden without JavaScript or blinks out on load; reduced motion skips it. `components/ui/Spinner.tsx` replaces BuyBox's inline spinner. Unused component classes and keyframes are purged by Tailwind until a page uses them. Each Reveal reads its position once at hydration; fine at today's handful per page, batch the reads if a page ever carries dozens. Tests: compiled CSS checked through postcss and Tailwind; Reveal's browser behaviour checked in jsdom (dev dependency jsdom 25.0.1, tests only). "Haskell's law" in the request was Tesler's law (confirmed 14 Nov); applied in part 5.

**2026-11-14: private library, part 2 of 5 (bucket, table, /library).** Migration `20261114_create_library.sql` makes the private `library` bucket (50 MB, PDF only, forced private on re-run) and `library_grants` (RLS on, no grants to the public keys). `openCode` checks the code, stamps the grant's one copy at `copies/<grantId>.pdf`, signs a 5 minute link, and only then records first use with a conditional update, so a failed stamp never spends a review code and two clicks cannot both start a window. Copies are reused for an hour and swept by their age in storage after two, before every fresh stamp, under a 5 second cap that never deletes late or the grant's own file; a cached copy that has gone is stamped again. Storage calls use their own 30 second deadline that covers the body. The library refuses to run without the service-role key. **Still to confirm once live:** that signing a missing object returns an error (the reuse fallback depends on it), and a real 15 MB upload time from the production region.

**2026-11-14: private library, part 1 of 5 (codes and stamping).** `lib/library.ts` holds the rules: 12-character Crockford codes (60 bits) stored only as an HMAC with `LIBRARY_CODE_SECRET`, typing-tolerant normalising, recipient names cleaned to what the PDF font prints (capital form checked too), review codes 60 days with a 24 hour download window after first use, paid copies a year; unknown or unreadable rows count as closed. `lib/library-stamp.ts` prints the name at the foot of every inside page inside the crop box, cover untouched, and refuses rotated pages, oversize masters and stamps that do not fit. Measured on the real reading editions: under 100 ms and about 100 MB. `scripts/make-reading-edition.py` turns a print PDF into a reading edition (NC 101 MB to 10.7 MB, Geezy 62 MB to 14.3 MB).

**2026-11-13: school request email sender.** Notices to Ray now come from "Puen Publishing" instead of the Chief Explorer name in EMAIL_FROM. sendEmail takes an optional fromName; the address stays the configured one, the name is quoted and stripped of quotes, brackets and line breaks. Test request delivered to info@ on 12 Nov and the row was deleted.

**2026-11-13: flaky tests fixed.** The scout, family and patrol local stores rewrite whole JSON files in data/, and parallel test files shared them, so writes were lost and referral and patrol tests failed at random. They now honour LOCAL_DATA_DIR, and vitest.setup.ts gives each test file its own temporary folder. 5 full runs in a row passed.

**2026-11-12: school requests (Neighborhood Chronicles, part 1 of 3).** Ray is mailing school principals about The Neighborhood Chronicles by 14 Nov. This part is the back end of the page they will reach: `public.school_requests` (`supabase/migrations/20261112_create_school_requests.sql`, RLS on, server only), validation in `lib/school-requests.ts` (honeypot field `website`), storage, paged admin list and an optional email to Ray in `lib/school-request-store.ts`, and `POST /api/school-request` (20 valid requests per hour per IP). Resend is already live on `send.puenpublishing.com` (the October Patrol receipt was delivered through it), so Ray also gets each request by email; the saved row stays the source of truth. `/api/health` checks the new table. **Open:** run the migration in the Supabase SQL editor before deploying, or `/api/health` reports `schoolRequestsTable` failing and the form answers 503. Next: part 2, the `/neighborhood` page and form (reached by QR and letter only, no header link), waiting on Ray's cover, cast art and preview pages; part 3, the admin list.

**2026-11-11: Bonus Video on /start.** Ray asked for the Bonus Video (Sunny's 700-Point Book 2 Challenge) to play on /start, the last code in the book. `app/start/page.tsx` is now a server page that reads the `bonus` row (1.5s deadline, `loading.tsx` meanwhile) and renders `components/start/BonusVideo.tsx` above the form only when live; the form moved to `app/start/StartForm.tsx`. With the video live, a signed-in family stays on /start with a "Welcome back" card instead of being redirected (`afterSessionCheck`). Video alerts now dedupe per reason and video. **Open:** run `supabase/migrations/20261111_add_bonus_video.sql` in the Supabase SQL editor (until then /start simply shows the form), then set the id once Ray sends a working link. Ray's 11 Nov links: Videos 3 (kJ5uUvPdUEE) and 4 (22h_p86EbM4) are the same video under two titles, so neither is connected; the other five links arrived without ids.

**2026-11-10: page count badge.** Sarah's corrected interior (`Book 1 complete (10)`, 36 US Letter pages, cover included, all art 300 DPI or higher, page 3 credits New Life Mission Network, Inc.) was checked and accepted. `book1.pageCount` is now 36, shown in the hero badge and the details list, with a test.

**2026-11-09: storefront title, cover and link preview.** Book 1 is now called "The Adventures of Geezy Goober" with "Volume 1: The Search for the Magic Pen", matching the 30 Oct cover and the copyright page; the retired "Guide to Icky Sfand" title is gone from the storefront, the page description and the Stripe product name. New cover `public/book1-cover-v2.jpg` (900 x 1165, front panel of the 30 Oct wrap) and a 1200 x 630 link preview `public/og-book1.jpg` with Open Graph and Twitter tags. The hero badge was fixed on 2026-11-10 (see below).

2026-11-04: the seven Book 1 QR codes are served as one file at
`/print/geezy-book1-qr-codes.zip`, so Ray can forward a link to Sarah instead of a chat attachment he
could not find. Static file, test in `lib/print-files.test.ts`.

2026-11-03: new static page `/certificate` (`components/certificate/CertificateDownload.tsx`,
files in `public/certificate/`). The printed book now carries a black and white certificate (one ink
type per book at IngramSpark), and a line under it sends parents to this page for the free color PDF:
the 300 DPI artwork on one US Letter page, about 2 MB instead of the 19 MB original. No database, so
it works while Supabase is paused. The address is printed, so it must never move. Also: the site
header's Gallery, Details and Buy Now links were bare hashes and did nothing on any page except the
home page (/certificate, /guide); they now point at `/#...`. The nonprofit's registered name is
**New Life Mission Network, Inc.** (Ray, 3 Nov), replacing "Board" in the footer credit and the docs.

2026-11-02: Book 1 retail price raised from $6.99 to $14.99 (Ray's decision of 29 October;
`RETAIL_PRICE`, with a test on the amount Stripe is actually asked to charge). The Patrol stays at
$10 for now: Ray's $15 version is a different product (two printed books), and its checkout collects
no shipping address yet, so changing the price alone would sell the old product at the new price.
`/api/health` no longer hangs when the database is unreachable: the reads run together, the whole
check answers within 6 seconds, and the deadline aborts every query still in flight, so a paused
Supabase project now shows as `databaseReachable: false` instead of a request that never answers.
Found while the live site's video pages were all showing the waiting screen because the database
was not answering (being checked in the Supabase dashboard).

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

## Phase 4 (2026-10-09) — printable sticker sheet

| Item | Change |
|---|---|
| Sticker sheet | `public/stickers.pdf`, served at `puenpublishing.com/stickers.pdf`. One US Letter page at 300 DPI carrying all 19 virtue badges, numbered, with a 1 inch gap and dashed cutting guides around each so a parent can cut them out for gummed paper. The address is printed in the Parent's Guide, so **the path must never change** — when badges 20 to 25 arrive from Aymen, replace the file at the same path rather than adding a second one. Generated from `public/stickers/slot-01..19.png`. |

**Open:** the book is moving from 19 virtues to 25. Six more badges are owed by Aymen
(the guide already names them). When they land, regenerate this sheet at the same path.
