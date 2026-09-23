# PROGRESS

_This file is maintained by the quality-kit rules in `CLAUDE.md` (section 9). For the authoritative,
prioritized task list (P0-P3) and acceptance tests, see the live tracker linked from
`NEXT_SESSION_HANDOFF.md` in the parent folder — update that tracker too, not just this file._

## Components

| Component | Status | Notes |
|-----------|--------|-------|
| Retail storefront + checkout (Stripe test mode) | done | Live, verified Sept 22-23 |
| Institutions sponsorship page ($40/$200/$400) | done | Live |
| MailerLite buyer sync | done | Live |
| Sticker badges (19 real PNGs) + sticker sheet PDF | done | Slot #19 has a checkerboard artifact baked in; waiting on Ray's corrected file |
| Supabase persistence | done | Fixed Sept 22 — production had no Supabase URL / placeholder key since Sept 14 hardening; `/api/health` now writes and reads back to catch stale-cache regressions |
| Family accounts (`/start`, per-family dashboard, session cookies, sponsor-by-share-code) | done | Live-tested Sept 22 |
| Dashboard fixes (no pre-filled address, no false dispatch status, correct 700-point copy) | done | |
| Order logging + Stripe webhook failure alerts | done | Paid test order saved, webhook delivered, `pending_webhooks: 0` |
| Domain `puenpublishing.com` -> Vercel | planned | Tracker t25 — blocks QR codes and email DNS |
| Resend email service + login link (2nd device) | planned | Tracker t32 — depends on domain |
| Chief Explorer naming on completion banner + sticker sheet | planned | Tracker t11 |
| Parent's Guide funnel ($29.97 digital, $10 Patrol, gift QR codes, gift registration, approval gate) | planned | Tracker t12-t15 |
| Real friend tracking (2 of 3 -> 300 pts) | planned | Tracker t16 |
| MailerLite lifecycle emails | planned | Tracker t17 |
| Ray's admin view | planned | Tracker t18 |
| Rotate Stripe keys exposed in git history | planned | Tracker t09 |
| Deliver $270 Fiverr order | planned | Tracker t26 — due Oct 4, 2026 |

## Known issues

- Sticker slot #19 has a checkerboard pattern baked into the source file; a cleaned temporary
  copy is live but the real fix needs Ray's corrected asset.
- Store still shows placeholder cover/interior images pending Ray's high-res files.

## Tech debt log

- Stripe test keys were at some point committed to git history and need rotation (t09).

## Last session summary

2026-09-23: Read `NEXT_SESSION_HANDOFF.md`; installed the CLAUDE Code quality kit
(`CLAUDE.md`, `.claude/settings.json`, hooks, `/setup` `/audit` `/fix-audit` `/next` `/qa`
commands, `code-auditor` and `qa-reviewer` subagents) into this project per the user's request,
so future sessions enforce lint/typecheck/test gates automatically on edit, commit, and turn-end.
`typecheck` script was added to `package.json` to support this.
