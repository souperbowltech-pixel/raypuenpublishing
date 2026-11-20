# Instructions for coding agents (Codex and others)

1. Read `CLAUDE.md` in this folder: its engineering rules, QA gate and forbidden list apply to every
   agent working here, not only Claude.
2. The project's working handbook is outside this public repo, two folders up:
   `../../CODEX_HANDBOOK.md`. Read it before any task. It holds the client rules and where the
   trackers are.
3. This repository is public. Never commit prices, client messages, keys, `.env*` files,
   `files from ray/` or `refrence video/`.
4. Never edit anything inside `.claude/`.
5. Checks before any commit: `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=2`.
   Paste the real output in your report. Never weaken or skip a test.
6. No em dashes or en dashes in any text, comment or commit message.
7. Do not push to `main` or deploy unless the person you work for says so in that conversation.
