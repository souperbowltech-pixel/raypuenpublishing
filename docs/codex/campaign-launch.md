# Character Vote Campaign: staging and release runbook

The implementation is local on `feat/character-vote-campaign`. Do not advertise the
campaign until the gates below are complete. Existing storefront and checkout stay
on their existing deployment. No hosted migration, external client message or production deployment was
performed by this build. Isolated local PostgreSQL verification was later run.

## Routes and boundaries

- `/welcome`: existing NC Welcome Video, adult vote/delivery form, five characters.
- `/welcome/thanks#receipt=...`: private confirmation and download, then reservation
  or the existing NC order link, selected by the server's Stripe mode.
- `/welcome/download#receipt=...`: opens the private PDF from the backup email.
- `/admin/campaign`: existing admin session, totals, current page CSV, reservations
  and per-message status/retry. CSV exports 50 records at a time, not all data.
- `/api/campaign/health`: configuration/schema/file readiness, no private data.
- `/api/campaign/worker`: authenticated GET for a bounded retry batch.

Source URLs use `?ref=fiesta`, `?ref=church`, `?ref=school`, `?ref=melissa-data` or
`?ref=dm`. Unknown values become `direct`. These count saved vote sources; this
implementation does not claim video-view analytics or paid-order attribution.

## Configuration, without putting secrets in files

Use the existing service-role Supabase, private `library` bucket, transactional
email configuration and admin token. Add independent random values of at least
32 characters for `CAMPAIGN_SECRET` and `CRON_SECRET` in hosting settings. The
campaign secret signs 30-day private receipts; rotating it invalidates existing
links. Keep production, staging and test secrets separate. Never paste them into
chat, a URL, Git, a screenshot or a command argument.

Confirm the canonical site origin for staging before sending any real test email.
Use an approved test inbox, never a customer's address. Do not enable Stripe live
keys just to test this campaign. Existing checkout owns payment verification and
printing remains manual through IngramSpark.

## Database checks

1. In a separate Supabase staging project, apply the existing schema/migrations,
   then `supabase/migrations/20261122_create_campaign.sql`.
2. Run `supabase/checks/campaign_acceptance.sql`. It uses a transaction and rolls
   test writes back. It verifies replay/conflict handling, reservation preservation,
   one outbox item per kind, active lease exclusion, wrong lease refusal, public
   privileges and fault-injected rollback of the actual submit RPC.
3. Verify anonymous/authenticated REST requests cannot read either campaign table
   or execute any campaign RPC. A service-role caller must succeed.
4. Use two independent database sessions to exercise genuinely concurrent calls:
   same submission and fingerprint must produce saved/replay for one row; different
   submission IDs with the same email must produce saved/duplicate. There must be
   one welcome job. Changed fingerprint on the same submission must conflict.
5. Claim the same due batch from two sessions at once. Each job belongs to one
   lease only. Wrong lease cannot finish it. After expiry, another worker may claim
   it; the old lease cannot acknowledge the replacement. Verify backoff and five
   failed-attempt exhaustion, then protected admin retry.
6. Withdraw a staged vote. Receipt/kit/reservation fail, no new job can be claimed,
   no retry control appears and its jobs leave pending/failed totals.

Local execution is now verified on portable PostgreSQL 17.12, with real roles,
BYPASSRLS, transactions and independent concurrent sessions. Run:

`python supabase/checks/run_campaign_local.py --pg-bin <portable-bin> --output <private-evidence-folder>`

Nineteen groups passed, including actual service-role summary totals and all six
RPC denials for both public roles. Real permission, worker-lock and summary-total
regressions were rejected under deliberate SQL mutation; restored runs passed.
This is not hosted Supabase REST/storage verification. Repeat the hosted checks
above in staging before release.

## Starter Kit and artwork

Generate the kit with `node scripts/build-campaign-kit.mjs --out <absolute-path>`.
It uses the three existing NC sample coloring images, the matching canonical Guide
entries and badges. The confirmed layout is six PDF pages, not three: one coloring
page and one matching Guide page per activity. No full book or private client
transcript is included. The generated delivery PDF stays outside the public repo.

The delivery draft uses 300 DPI grayscale renders from the latest high-resolution
interior, with source-page first lines checked against Purpose, Fairness and
Sincerity before rendering. Supply those reviewed images using
`--coloring-dir <absolute-folder>` with filenames `page-3.jpg`, `page-4.jpg` and
`page-5.jpg`, matching the canonical web sample names. The default web images are
lower-resolution preview sources; do not describe a default build as a print master.

Inspect all six pages at 100%, print one activity, check text fits, badges match and
no image is missing. Current badges are black and white; final color badges and
five approved character portraits still depend on supplied artwork. Do not claim
full-color badges until those files replace the current ones and are verified.

Upload the approved PDF to the private `library` bucket as
`campaign/starter-kit.pdf`. Confirm the bucket is not public. A guessed storage
address must fail, an authorized five-minute URL must work and expire, and deleting
the file must produce an honest unavailable state. Never place it under `public/`.

## Real delivery and scheduler activation

Initial submission attempts its queued email immediately. Automatic retries require
an active scheduler; a worker route or configured secret alone does not schedule it.
No scheduler was registered and no Vercel plan was changed by this build.

Configure an approved scheduler to issue GET `/api/campaign/worker` every five
minutes with `Authorization: Bearer <CRON_SECRET>` set securely. If the current
hosting plan supports that cron frequency, merge an appropriate `crons` entry into
its deployment configuration. Otherwise the operator must choose a compatible
scheduler before launch; do not silently upgrade a paid plan. Each invocation
handles at most three messages. Observe queue age and tune batch/worker capacity
before any much larger send. Do not assume this retry throughput supports a
250,000-name campaign after a prolonged provider outage.

Verify with an approved staging inbox:

- Every character receives the matching approved message, PDF link and book link.
- The PDF opens on another device from the emailed fragment capability.
- A reservation sends the owner notice and remains clearly unpaid.
- Simulated provider outage retains the job; recovery plus scheduled invocation
  sends it. A repeat invocation does not resend an acknowledged job.
- A lost acknowledgement is retried using the same provider idempotency key.
- Over-30-day welcome jobs are retained as expired failures, never emailed with
  a dead link. Owner reservation notices remain deliverable.
- Admin shows exhausted retries and can retry only eligible unsent messages.

Provider acceptance is not inbox delivery. Provider deduplication lasts 24 hours;
a crash between acceptance and database acknowledgement may still yield a
duplicate after that window. No exactly-once delivery guarantee is made.

## Phone/browser verification

Use a staging deployment or an already authorized preview. The user authorized a local server and Playwright on 22 November. Twenty-four
campaign browser checks passed, including actual Welcome playback, validation,
focus, retry, missing/forged receipts and 320/375px layout bounds. Success receipt
and reservation UI used explicitly labelled API fixtures; they do not prove
hosted persistence or delivery. A real phone journey remains a release gate.
The NC printed portals have a separate browser geometry job with external media
blocked; it must not be presented as five-video playback verification.

Check 320, 375, 768 and desktop widths; keyboard-only radio and checkbox operation;
clear required/optional labels and focus after errors/success; blocked video;
network loss before/after save; same UUID on unchanged retry; back/refresh of the
private receipt; expired/missing file recovery; reservation vs actual live order
link; no control overlap; meaningful content without motion. Inspect image weight,
contrast and all text without assuming that a DOM test proves visual layout.

## Verification commands and rollback

Run `npx.cmd tsc --noEmit`, `npm.cmd run lint` and
`npx.cmd vitest run --minWorkers=1 --maxWorkers=2`. The explicit minimum avoids this
machine's default thread-minimum conflict. Do not weaken or skip existing tests.
Mutation checks: `python scripts/campaign-mutations.py <domain|store|delivery|ui|admin>`.
Run mutations only while no other test runner, reviewer or editor is using those
files. Every mutated file is restored byte-for-byte, including on failure. Evidence
is written to a temporary directory and records mutant/restored exit codes plus
which tests were observed failing.

After all staging gates, the operator approves production migration and deployment.
Then check ordinary `/api/health`, campaign readiness and a complete approved test
journey. Staging-only fixtures and test data must never become customer records.

For rollback, stop campaign ads and scheduler, remove campaign links, and deploy the
previous application version. Preserve campaign tables/outbox and private storage
for recovery; do not drop customer data. Campaign code does not change existing
retail prices, payment verification or print dispatch behavior.

## Supabase Cron option, pending connected account verification

Supabase documents pg_cron with pg_net HTTP calls and Vault-backed tokens:
https://supabase.com/docs/guides/functions/schedule-functions

Once the project's extensions and permissions are confirmed, store the canonical
HTTPS worker URL as Vault name `campaign_worker_url` and the same CRON_SECRET used
by Vercel as `campaign_worker_secret`. Set values securely through the connected
accounts, never as literal SQL in a file or chat. Verify the target does not
redirect, the secret is independent and at least 32 characters, and the worker
returns HTTP200 with authorized credentials before scheduling.

An owner can then schedule this request every five minutes:

```sql
select cron.schedule('nc-campaign-retry', '*/5 * * * *', $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_secret')),
    timeout_milliseconds := 65000
  );
$job$);
```

This is an activation recipe, not an executed migration or verified scheduler.
An enqueued pg_net request does not prove HTTP success. Check cron job runs and
net._http_response for a successful200 response and the worker's JSON result;
then prove queued-email recovery with the approved test inbox. Inspect the
extension/vault/request queue privileges and protect token-bearing queue entries.
No scheduler, paid plan change or new service account was activated locally.
