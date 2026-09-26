# START HERE — every session, whichever tool you are

This file is the front door. It is written for any agent: Claude Code, Antigravity, or a human
picking the project up cold. Read it, then `NEXT_SESSION_HANDOFF.md`.

## What this project is

The Geezy Goober platform for Puen Publishing (client: Ray Puen, via Fiverr). Next.js 14 App
Router on Vercel, Supabase for data, Stripe for payments. Live at **https://puenpublishing.com**.
The paid order is **$270, due 4 October 2026**.

## The first five minutes

1. Read `NEXT_SESSION_HANDOFF.md` (repo parent folder) — **section 0 is the freshest truth and
   overrides everything below it.**
2. Read `RAY_CLIENT_COMMUNICATION_LOG.md` (newest entry first) and `WAITING_ON_RAY.md`.
3. Check the live site: `https://puenpublishing.com/api/health` must return `ok: true` with every
   check passing.
4. Read `docs/book-structure.md` — what is actually on each page of Book 1.
5. `AUDIT.md` and `FIX_PLAN.md` hold the issue register and how each finding is being handled.
6. Say back, in five lines: current state, what is done, what is pending, what is blocked, and what
   you think the next task is. **Do not start building until the user answers.**

## Where everything lives

Paths are on the user's machine; the repo sits inside the project folder.

| Thing | Where |
|---|---|
| Project folder | `D:\fiverr client\Ray puens work\` |
| Code (this repo) | `…\Rapuenpublishingcodebase\Rapuenpublishing-claude-puen-publishing-m1-mn6yy2\` |
| Current status, priorities, what changed last | `…\Ray puens work\NEXT_SESSION_HANDOFF.md` §0 |
| Every message to and from the client | `…\Ray puens work\RAY_CLIENT_COMMUNICATION_LOG.md` |
| What we are chasing the client for | `…\Ray puens work\WAITING_ON_RAY.md` |
| What is in Book 1, page by page | `docs/book-structure.md` (in this repo) |
| Client's raw files (PDFs, attachments) | `files from ray\` — **gitignored, contains his plaintext passwords** |
| Things prepared for the client | `…\Ray puens work\Puen_Delivery_2026-09-**\` |
| Task board (priorities + acceptance tests) | <https://claude.ai/artifact/LoTZHH98UCqWa9DoE7swi7> |
| Tracker changes waiting to be applied | `docs/TRACKER_PENDING.md` |

**Progress is saved by committing.** Nothing is done because a session says so. It is done when it
is committed, the documents above are updated in the same change, and the live site or the test
suite proves it. A session that ends without committing has saved nothing.

## Rules that do not bend

**Client and communication**
- **Nothing outward-facing without the user's explicit go-ahead** — no messages to Ray, no Fiverr
  delivery, no published posts. Draft it; the user sends it.
- **Fiverr blocks messages containing an email address.** Describe the inbox instead of writing it.
- Ray forwards these messages to a committee and an adviser reads them back to him: plain English,
  short sentences, no jargon, and say plainly what you need him to decide.
- Log every message, in and out, in `RAY_CLIENT_COMMUNICATION_LOG.md` — **the full text, never
  "see chat"**, because a chat is gone by the next session.
- Never claim a feature works when it is not wired up.

**Security and privacy**
- Never print, paste or commit a key. Keys go straight into Vercel or Supabase, never into a file.
- Never commit anything from `files from ray/`.
- Never ask Ray for a password.
- **The granddaughters are credited by their middle names only** — "By Ray Puen inspired by Grace
  and Joy." Their first names must never appear on the site or in print. `lib/book.test.ts`
  enforces this; do not weaken that test.
- Do not publish a child's name, a customer email or a scout token into logs or alerts.

**Engineering**
- Never run `npm run build` while a dev server is running. Stop the server first.
- Verify before claiming: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`, `npm run build`,
  then the real behaviour, then the live site. **Paste the real output.** "Should pass" is not a
  result.
- Every new test must be mutation-checked: break the thing it guards and watch the test fail. A
  test that has never been seen to fail proves nothing.
- Never weaken a test, skip a check, or add an ignore comment to get past a gate.
- Repo files are CRLF. Normalise `\r\n` before matching in scripted edits.
- One component, one commit, with the docs updated in the same commit.
- `gh` is not installed. Deploy by merging into `main` and pushing; Vercel deploys from `main`
  automatically. Then confirm with `/api/health` and a real request.
- The full engineering rules are in `CLAUDE.md`. They apply to every agent, not only Claude.

**Replies**
- Replies to the user are in Roman Urdu. Code, commit messages and client messages in English.

## What no agent can do from here

| Not possible in this repo | Who does it |
|---|---|
| Running SQL against Supabase (no DDL, no row edits — there are no database credentials locally) | the user, in the Supabase SQL editor |
| Setting environment variables or keys | the user, in Vercel / Supabase |
| Sending anything on Fiverr | the user |
| Switching a Stripe or GitHub setting | the user |

When a task needs one of those, write the **exact SQL or the exact click-path** into your reply and
hand it to the user. Do not work around it and do not pretend it is done.

## Keeping the task board in sync

The board at the link above is a Claude artifact; only a Claude session can republish it. Any other
agent records what should change in `docs/TRACKER_PENDING.md`, and the next Claude session applies
those entries and clears the file.

## Handing the session over

Whatever tool you are, before you stop:

1. Update `NEXT_SESSION_HANDOFF.md` §0 with what changed, what is verified (with the evidence), and
   what is still open.
2. Log any client message, both directions, in `RAY_CLIENT_COMMUNICATION_LOG.md`.
3. Move anything new the client owes us into `WAITING_ON_RAY.md`.
4. Append to `docs/TRACKER_PENDING.md` if a task's status changed.
5. Commit and push. Say plainly what you did **not** finish.

Picking it up again, in any tool:

```bash
git pull
npm install
npx vitest run
```

If the documents and `git log` disagree with anybody's memory, the repository wins.

## The prompt to start a session with

> Continuing the Puen Publishing (Geezy Goober) project for the Fiverr client Ray.
> Read `START_HERE.md`, then `NEXT_SESSION_HANDOFF.md` section 0, then
> `RAY_CLIENT_COMMUNICATION_LOG.md` and `WAITING_ON_RAY.md` in the parent folder.
> Check `https://puenpublishing.com/api/health`. Then tell me the current state in five lines and
> what you think the next task should be — do not start building until I answer.
