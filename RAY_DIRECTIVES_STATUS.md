# Ray's Directives — Implementation Status

Tracking the work from the Sept 16 email thread (Stripe/MailerLite hardening,
point-gate logic, referral engine, dual-unlock paths, print fulfillment) and the
Sept 18 spec (Module A sticker album + Module B continuity loop).

Legend: ✅ Done · 🔧 In progress · ⛔ Blocked (needs Ray) · ⬜ Not started

Last updated: 2026-09-18

---

## Sept 18 — Module A & B

**Module A — 19-Slot Sticker Album**
- A1 ✅ Interactive 19-slot grid with grayscale→full-colour toggle (numbered gray
  silhouette when locked; full-colour PNG merit badge when complete).
- A2 ⛔→ready: real badge PNGs drop into `public/stickers/slot-01.png … slot-19.png`
  (illustrator ~Sept 19). Grid + PDF fall back to numbered placeholders until then.
- A3 ✅ "Download Master Sticker Sheet" — server route `GET /api/stickers/sheet`
  builds a print-ready 8.5×11 PDF of all 19 badges (pdf-lib). Verified valid PDF.

**Module B — Grandpa Multiplier Continuity Loop**
- B1 ✅ Dual-key already live: Pathway A (2 friends→300→Book 2), Pathway B ($40→Book 3).
- B2 ✅ Rule 1 (Temporary Bypass): account never locked; Grandpa link is a quiet button.
- B3 ✅ Rule 2 (Continuation Hook): persistent Book 2 banner with Ray's exact copy,
  shown when `book2Unlocked && !book3Sponsored`.
- B4 ✅ Rule 3 (Leap-Frog): $40 event unlocks Book 3 from any point. Ray may add an
  extra step "before/with Book 3" later — unlock kept modular for easy extension.

**QR checkouts (Ray's confirmation)**
- ✅ Grandpa `$40` link now has a scannable QR (component `SponsorQRCode`) pointing at
  a new public landing page `GET /sponsor?token=…` that starts the sponsorship checkout.

Confirmed by Ray (Sept 18): Biblical 700 = 400 quiz + 300 referral (unchanged); QR
codes wanted wherever a checkout link is used; stickers delivered sequentially.

New files: `lib/stickers.ts`, `app/api/stickers/sheet/route.ts`, `app/sponsor/page.tsx`,
`components/dashboard/Book2ContinuationBanner.tsx`, `components/dashboard/SponsorQRCode.tsx`,
`public/stickers/README.md`. Deps added: `pdf-lib`, `qrcode`.

Verification: `tsc --noEmit` clean · 19/19 tests · `next build` passes · live E2E
(banner shows at 700, PDF streams, QR renders, /sponsor page starts checkout).

---

## Summary of Ray's 6 directives

1. **700-point track** — 400 (comprehension quiz) + 300 (referral) = 700 → fires
   `Unlock_Volume_2` and grants free access to **Book 2**.
2. **Referral = 2 friends** — the 3-pack form captures 3 names, but the 300-point
   trigger fires the moment **any 2 of the 3** invited friends log in and turn
   their Page 1 sticker from grayscale to full colour (no purchase/quiz needed).
3. **Branding / legal credit** — inject the credit string into the app + Stripe
   receipt templates + MailerLite transaction footers (no new email service).
4. **Print fulfillment** — drop Lulu; use **IngramSpark** as the print-on-demand
   / distribution network. Master PDFs + IngramSpark API keys to come from Ray.
5. **Label alignment** — child reads Book 1; 700 pts unlocks **Book 2** free.
6. **Grandpa multiplier** — a relative's **$40** sponsorship link leap-frogs to
   pre-approve and unlock **Book 3** free, in parallel with the peer Book 2 path.

---

## Task board

| # | Task | Status | Notes |
|---|------|--------|-------|
| A | Unlock label fix: 700 pts → Book 2, status `Unlock_Volume_2` | ✅ | scout-store, ScoreGate, BookUnlockCard, dashboard |
| B | Referral engine: any 2 of 3 friends → 300 pts | ✅ | data model, update route, QuestCaptainBox (3 slots) |
| C | Grandpa $40 sponsor → unlock Book 3 (parallel path) | ✅ | sponsor checkout + confirm routes, webhook, cards |
| D | Lulu → IngramSpark (UI text) | ✅ | BookUnlockCard copy; API wiring still ⛔ (Ray) |
| E | Legal credit line in app footer | ✅ | already live in `lib/book.ts` + `SiteFooter.tsx` |

### Files changed / added this pass
- `lib/gamification.ts` — added `REFERRAL_FRIEND_REQUIREMENT` (2),
  `REFERRAL_INVITE_CAPACITY` (3), `GRANDPA_SPONSOR_PRICE` (40); fixed gate copy.
- `lib/scout-store.ts` — new `friendsCompleted` + `book3Sponsored` fields, single
  `deriveScoutFields()` recomputer, status → `Unlock_Volume_2`, Supabase read
  fallbacks + best-effort write of new columns.
- `app/api/scout/update/route.ts` — referral input is now friend-count based.
- `app/api/checkout/sponsor/route.ts` — **new**: $40 Grandpa Stripe checkout.
- `app/api/checkout/sponsor/confirm/route.ts` — **new**: secure on-return unlock.
- `app/api/webhooks/stripe/route.ts` — unlocks Book 3 on `grandpa_sponsorship`.
- `components/dashboard/ScoreGate.tsx` — Book 2 / `Unlock_Volume_2` labels.
- `components/dashboard/QuestCaptainBox.tsx` — 2-of-3 friend tracker + slots.
- `components/dashboard/BookUnlockCard.tsx` — **new**: generic Book 2 / Book 3
  card, IngramSpark text (replaces `Volume3UnlockCard.tsx`, now deleted).
- `components/dashboard/GrandpaSponsorCard.tsx` — **new**: $40 sponsor CTA.
- `app/dashboard/book2/page.tsx` — wires all of the above; quiz now Book 1.
- `supabase/migrations/20260916_add_friends_completed_and_book3_sponsored.sql` — **new**.

---

## Detailed notes / follow-ups

### E — Footer credit (app side): DONE
- Credit string: `lib/book.ts` → `publisherBrand.fullCredit`.
- Rendered: `components/retail/SiteFooter.tsx` and `app/checkout/success/page.tsx`.

### Credit line on Stripe checkout — DONE in code ✅
- Added `custom_text.submit.message = publisherBrand.fullCredit` to all three
  checkout routes (retail, wholesale, sponsor). Verified live on the real Stripe
  Checkout page — the credit line renders directly above the Pay button.
- Note: Stripe's *emailed payment receipts* have no free-text footer field, so the
  credit is placed on the checkout page (in code) + the app success page. For a
  footer on **invoices**, use Stripe → Invoicing → Invoice template → Footer.

### Outside the codebase (dashboard config — set per mode; sandbox ≠ live)
- **MailerLite transaction footer** credit — set in MailerLite account footer.
- **Stripe business identity** on receipts — Settings → Business → Public details.
- Reminder: Stripe **sandbox and live settings are separate** — dashboard config
  must be redone in the live account at launch. Code changes carry over automatically.

### ⚠️ Dev workflow warning
- Do NOT run `npm run build` while `npm run dev` is running — both write `.next`
  and it corrupts ("Cannot find module './379.js'"). To build: stop dev first,
  or delete `.next` and restart dev afterward.

### Blocked on Ray (Task D — real print wiring)
- ⛔ Master cover PDFs (in progress on Ray's side with illustrators).
- ⛔ IngramSpark API authorization parameters.

### Database note
- New scout fields (`friends_completed`, `book3_sponsored`) need Supabase columns
  for cross-device persistence. A migration file is added under `supabase/`.
  Until applied, these fields persist via the local/in-memory store only (the app
  degrades gracefully — the primary upsert still lands).

### Config / env needed for the new features to be fully live
- `ALLOW_DEMO_REFERRAL=true` — enables the "Simulate Friend Join" demo controls
  on the dashboard (same gate that already guarded the old referral demo).
- Stripe **webhook** must point at `/api/webhooks/stripe` for the automatic
  Grandpa Book 3 unlock. As a safety net, the dashboard also confirms the unlock
  on return via `/api/checkout/sponsor/confirm` (verified server-side), so it
  works even if the webhook isn't configured yet.
- Run the Supabase migration to persist `friends_completed` / `book3_sponsored`.

### Verification — all green ✅
Static checks:
- `npx tsc --noEmit` → exit 0 (no type errors)
- `npm test` (vitest) → 19/19 passed
- `npm run build` (next build) → exit 0; new routes present:
  `/api/checkout/sponsor`, `/api/checkout/sponsor/confirm`, `/api/webhooks/stripe`.

Live end-to-end (dev server, `/dashboard/book2`):
- Quiz: 4/4 correct → 400 pts, status **Academic_Pass** ✅
- Referral: 2 of 3 friends simulated → "300 Points Awarded", 2-of-3 gate met ✅
- Total 700 → status **Unlock_Volume_2**, "Book 2 Unlocked 100% Free!" card ✅
- Unlock card shows **IngramSpark** (no "Lulu" anywhere on the page) ✅
- Grandpa card shows "$40.00"; POST `/api/checkout/sponsor` returns a real
  Stripe test checkout URL (`cs_test_…`) — payment not completed ✅
- State API returns new fields correctly and persists them ✅
- Invalid scout token → HTTP 400 ✅

Notes:
- The "Cannot find module './379.js'" runtime error was a stale `.next` cache
  from mixing `next build` + `next dev`. Fixed by deleting `.next` and restarting.
  (Not a code issue.) If it recurs: stop dev server → delete `.next` → `npm run dev`.
- Added `ALLOW_DEMO_REFERRAL="true"` to `.env.local` to enable the referral demo.
- `sponsor/confirm` with a non-existent session id returns HTTP 500 (safely
  caught, no crash); the real return flow always supplies a valid session id.
