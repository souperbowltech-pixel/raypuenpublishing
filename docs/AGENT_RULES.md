# Rules for any agent working in this repository

Read this before you touch a file. It is not advice; it is the contract. A task that
breaks a rule here is not done, however good the code is.

These rules exist because this project's recurring fault has a name: **reporting success
without checking.** It has happened four separate times (BUG-01, FE-01, a health check
that reported a missing table as present, and three tests that passed for the wrong
reason). Every rule below is there to stop the fifth.

---

## 1. Scope

- Change **only the files the task names.** Nothing else.
- If you become convinced another file must change, **stop and say so in your report.**
  Do not change it. A task that grows while nobody is looking is how one problem becomes
  two.
- No cosmetic work in passing: no renaming, no reordering imports, no reformatting, no
  "while I was here" tidying, no running a formatter over anything.
- Never edit these files — they are the project's bookkeeping and are maintained
  elsewhere: `AUDIT.md`, `FIX_PLAN.md`, `NEXT_SESSION_HANDOFF.md`,
  `RAY_CLIENT_COMMUNICATION_LOG.md`, `WAITING_ON_RAY.md`, `docs/TRACKER_PENDING.md`,
  `PROGRESS.md`.

## 2. Dependencies

- **Do not install anything.** No `npm install`, no `npm add`, no new entry in
  `package.json`. The test environment is deliberately plain: `vitest` with
  `environment: "node"`, components rendered through `react-dom/server`. There is no
  jsdom and no `@testing-library/react`, and you may not add them.
- If a test seems to need a browser DOM, that is a signal to **extract the logic into a
  pure function** in `lib/` and test that. It is the better design anyway.

## 3. Commands

- **Never run `npm run build` or `next build`.** A dev server may be running and the two
  fight over `.next/`. This one is absolute.
- Use these, and only these, to check your work:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npx vitest run`
- Do not start or stop a dev server. Do not touch `.env.local` or any environment
  variable. Do not run a database migration.

## 4. Tests

- **Never weaken, skip, delete, or loosen an existing test to make the suite green.** If
  an existing test fails after your change, the change is wrong. Report it; do not touch
  the test.
- Every test you add must be **mutation-proven.** A test that cannot fail is worse than
  no test, because it buys false confidence. For each new test:
  1. Deliberately break the single thing the test guards (one small edit).
  2. Run `npx vitest run` and record the **exit code** (expect non-zero).
  3. Restore the file exactly.
  4. Run again and record the exit code (expect 0).
  Report the exact mutation you made and both exit codes. Use exit codes, not a
  screenshot of output — colour escape codes make the text unreliable.
- **Test the fix, not only a helper you extracted.** Moving logic into a pure function and
  testing that proves the arithmetic is right. It proves nothing about whether the component
  or route still calls it. On FE-06 the entire keyboard branch could be deleted from the
  component and all six new tests stayed green.
  So, as a final step on every task: **delete your whole change from the file it was meant to
  fix**, run `npx vitest run`, and record the exit code. If it is still 0, your tests do not
  guard the fix and the task is not finished. Restore the file and report that exit code in
  the MUTATION PROOF section alongside the others.
- Prefer a test that **exercises behaviour** over one that reads source for a string.
  Three tests in this repo passed with the feature deleted because they only searched
  text. If a string check is genuinely the only option, say so in the report and write a
  comment in the test explaining why.

## 5. Git

- Commit only after tsc, lint and the full suite all exit 0, and after every
  mutation in the task has been run and recorded.
- One commit per task. Never mix two backlog items in one commit.
- Never `git add -A` or `git add .` in this repository; stage files by name, every time.
- Message format: a short subject line in the existing style of this repo's
  log - read `git log -8` first and match it. Then a body that says what was
  wrong, why it mattered, and which mutations were run against it. Do not
  write a bullet list of files changed; the diff already says that.
- End every commit message with exactly this line:
      Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
- Push to origin main.
- Still never: `git checkout`, `git reset`, `git stash`, `git clean`, force
  push, or amend someone else's commit.
- Still never run `npm run build`.

## 6. The code itself

- The repository uses **CRLF** line endings. Do not convert a file to LF. If you edit
  with a script, match `\r\n`.
- Match the surrounding style: comments in this codebase explain **why**, not what, in
  plain sentences. Read a neighbouring file before you write one.
- Code, comments and commit messages in **English**.
- No `any`. No `@ts-ignore`. No `eslint-disable` without a sentence saying why.
- Never silently swallow an error. Never return a success value for something that did
  not happen.

## 7. The report

After every task, reply with **one message** in exactly this shape. Nothing is optional;
if a section does not apply, write "none" rather than removing it.

```
TASK: <the id you were given, e.g. FE-06>

FILES CHANGED
  <path>  (+added/-removed lines)   ... one line each

WHAT I CHANGED
  - <at most six bullets, plain English, what and why>

FULL DIFF
  <paste the complete output of `git diff` and, for new files, `git diff --no-index /dev/null <file>`>

TESTS ADDED
  <file :: test name>   ... one line each

MUTATION PROOF
  For each new test:
    test:      <name>
    mutation:  <the exact edit, e.g. `nextFocusIndex` return changed to `0`>
    exit code with mutation:  <n>     (must not be 0)
    exit code after restore:  <n>     (must be 0)

COMMANDS RUN
  npx tsc --noEmit      -> exit <n>
  npm run lint          -> exit <n>
  npx vitest run        -> exit <n>, <N> tests passed

WHAT I DID NOT DO
  - <anything in the task you could not finish, and why>
  - <anything you noticed that looks wrong but is outside scope — name the file and line,
     do not fix it>

UNSURE ABOUT
  - <anything you guessed at, or "none">
```

If you cannot complete the task under these rules, **say that instead of working around
them.** An honest "blocked, because X" is a useful answer here. A quiet workaround is not.
