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

- [ ] **t16** — Real friend tracking (2 of 3 friends colour Page 1 → 300 pts & Book 2 unlock) — Tested (migration `20260926_add_scout_referrals.sql`, 5 new tests in `lib/referrals.test.ts`, commit `c91bdd3`).
- [ ] **t12–t15** — Parent's Guide & Chief Scout Patrol funnel ($29.97 digital edition, $10.00 bundle with 3 gift QRs, registration gift redemption, Ray's one-click approval gate) — Tested (migration `20260926_create_patrol_and_guides.sql`, 5 tests in `lib/patrol.test.ts`, commit `d37947d`).
- [ ] **t11** — Chief Explorer naming consistency across banners, profiles, gamification strings, and tests — Tested (helpers in `lib/gamification.ts`, `ScoreGate.tsx`, `BookUnlockCard.tsx`, `family.test.ts`).
- [ ] **t35** — GitHub Actions CI workflow (`.github/workflows/ci.yml`) running `npm ci`, `lint`, `typecheck`, `test`, `build` — Tested.
- [ ] **t37** — Server-side shipping address validation for wholesale Tiers 2 & 3 in `app/api/checkout/wholesale/route.ts` — Tested.
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
