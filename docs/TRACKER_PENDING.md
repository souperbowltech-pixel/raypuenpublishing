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

_(nothing — the board is up to date as of 26 September 2026, board revision 107 / version 17)_

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
