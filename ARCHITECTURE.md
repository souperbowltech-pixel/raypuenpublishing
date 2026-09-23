# ARCHITECTURE

_This file is maintained by the quality-kit rules in `CLAUDE.md` (section 9). Keep it in sync with
what the code actually does. For current task status and priorities, see
`NEXT_SESSION_HANDOFF.md` in the parent folder — that file is the source of truth for "what's next"._

## Tech stack

- Next.js 14 (App Router) + TypeScript, deployed on Vercel (auto-deploys from `main`)
- Tailwind CSS
- Vitest for unit tests
- Supabase (Postgres) for persistence — family accounts, scout state, orders
- Stripe (test mode) for checkout + webhook
- MailerLite for buyer email sync
- `qrcode` + `pdf-lib` for generated sticker sheets / QR codes

## Folder structure

```
app/
  page.tsx                 # public retail landing page
  institutions/            # hidden wholesale/sponsorship portal
  start/                   # family registration
  dashboard/               # per-family scout dashboard
  api/                     # route handlers: checkout, stripe webhook, scout state,
                            # stickers, health check, family/session endpoints
components/
  retail/                  # hero, buy box, gallery, details, author, shipping
  institutions/            # wholesale form + pricing calculator
  dashboard/               # BookUnlockCard, progress UI
  ui/                      # shared UI (Lightbox, etc.)
lib/
  pricing.ts               # single source of truth for all pricing (unit-tested)
  checkout.ts              # checkout payload builders
  book.ts                  # book content/copy/image paths
  family.ts                # pure helpers for family/scout identifiers (unit-tested)
  family-store.ts          # Supabase-backed store + local dev fallback
  scout-access.ts          # authorization: who may read/write which scout's state
  scout-store.ts           # scout progress state
  supabase.ts              # Supabase client (fetch cache disabled — see gotcha below)
public/
  stickers/                # 19 real sticker badge PNGs (slot-01..19)
supabase/
  setup_production.sql     # schema applied to production Supabase
```

## Data flow / identifiers

Three identifiers per child, each with a different trust boundary:
- **Private scout token** (`scout_profiles.token`) — server-side only, never sent to the browser.
- **Public share code** `GG-XXXXXX` — used in the Grandpa QR / friend link; can only start a
  $40 sponsorship, never edit progress.
- **Session token** — random secret in an httpOnly cookie, stored server-side only as a SHA-256 hash.

`/api/scout/state` and `/api/scout/update` require a valid family session, or the demo token
`CAPTAIN-RAY-700` (used for Ray's demo dashboard at `/dashboard/book2?demo=1`).

## Key decisions (and why)

- **`cache: 'no-store'` on the Supabase fetch client** (`lib/supabase.ts`): Next.js caches the
  global `fetch`, and supabase-js runs on it. Without this, the live site served stale rows —
  writes landed but reads returned an old snapshot. `/api/health` writes and reads back specifically
  to catch a regression of this.
- **Print fulfilment gated behind `PRINT_FULFILLMENT_LIVE = false`** in
  `components/dashboard/BookUnlockCard.tsx` — flip on only once IngramSpark API access exists.
- **Repo files are CRLF** — scripted/programmatic edits must normalise `\r\n` before matching.
