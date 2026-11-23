# NC printed QR destinations and integration verification

## Scope and decisions

Provide seven stable Puen Publishing addresses for Sarah: Welcome, four sectional
lessons, Bring Two Friends, and Join the Secret Scout Club. Keep the existing
Geezy addresses untouched. Ray asked us to handle technical choices; own-site
addresses allow replacement videos without replacing printed codes.

## NC portal component

Purpose: a permanent destination for each printed NC code, with the correct book
and honest missing-video states. Input: one of seven allowlisted route slugs.
Output: an accessible NC video or invitation/kit page, and a labelled QR pack.
Dependencies: existing Next/Tailwind layout, validated YouTube URL builder, NC
Welcome/Video1 constants and supplied approved video records. No new npm runtime
dependency or credentials. Unknown slugs return 404; missing/unconfirmed videos
show a recovery page. Never reuse a Geezy video, family dashboard or reward claim.
All five NC videos have confirmed provider metadata, including Video 2
(pSd3ZForw2U). Bring Two Friends has no approved NC video yet. Do not claim a video exists
until its link is verified. Club entry can guide adults to the existing NC kit
request; NC child progress, referral rewards and free Book2 are not implemented
by this QR task and must not be promised by the page.

Security: allowlisted slugs, validated embed IDs, origin-only iframe referrer,
no private tokens in printed URLs, no open redirects, no customer contact reads.
Failure modes: missing video, blocked player, network loss, unactivated campaign.
Scale: seven static destinations; player requests go to the video provider.
Design: preserve the existing NC branding and typography; apply VF-TYPE-01 to
readable headings, 320px layouts, long URLs and zoom. No new art substitutes for
Sarah's pending approved artwork.

## Integration verification

Execute the existing campaign SQL against an isolated local PostgreSQL database
with anon/authenticated/service_role roles and BYPASSRLS only for service_role.
Prove actual role privileges, transactions and two-session races. Never label
this Supabase staging verification: hosted storage, REST, network and provider
behavior require connected accounts. The approved test inbox stays outside this
public repository. Test email sends are authorized only to that inbox. No owner
notice is sent to Ray as a side effect of testing.

## Acceptance

Each of seven QR PNG/SVG pairs decodes to its own canonical public URL; labels
and the placement guide agree. Verify all local destinations, missing-link states,
mobile layout and keyboard controls with Playwright. Verify final art separately.
Run lint/typecheck/full suite and mutation-prove new regression cases before a
component commit. A printed QR is not live until deployment and a public URL
check succeed. No new service subscription or paid plan is authorized implicitly.

## Verification record

Local TypeScript/lint checks and 1,125 tests across 103 files passed. The four new
rendered-page tests were mutation-proven with five deliberate regressions, each
nonzero, followed by exact byte restoration and exit zero. The independent
read-only reviewer approved the NC routing/content boundaries. A later review
caught weak browser mutation evidence; the runner now requires the exact failure
kind/viewport and a passing restored JSON report, not merely a nonzero process.

The supplied interior contains 45 PDF pages. Placement guide headings distinguish
lessons on PDF pages 9, 18, 26 and 36, Bring Two Friends on 41, and Family
Registration on 43. The opening Welcome box is not in that supplied interior.
Sarah must match headings if the final printer numbering changes.

Seven SVGs and fourteen PNGs were generated outside the repository. Every PNG
and every actual SVG rendering was independently decoded to its intended URL.
The seven-page guide was checked for matching labels and text fit. These files
are placement drafts until the public destinations are deployed and scanned.

Local media-heavy browser runs encountered Windows memory exhaustion. Welcome,
Lesson1 and a separate Lesson2 run showed actual playback; no claim is made that
all five playback checks completed. Server-rendered checks reached all seven
HTTP200 destinations. Four layout widths passed before a shared-header overflow
was observed at 200% text. The header fix and layout mutation evidence are to be
verified by the dedicated GitHub browser job before declaring that gate passed.
That job blocks external media and explicitly does not verify playback.

Python browser tooling is pinned in scripts/requirements-browser.txt. No npm
runtime dependency was added. Production has not been deployed by this work.

## 23 November: browser acceptance completed

The dedicated GitHub job passed all 13 geometry checks and both specific layout
mutations. Artifact evidence was downloaded and320px/enlarged-text screenshots
were inspected. The mutation proof identifies exact failure kinds and viewport
sizes, then requires a passing restored run. Vercel preview deployed successfully
but redirects unauthenticated readers to sign-in. Production/public QR addresses
remain gated on backend activation. This supersedes the earlier pending-CI note.

## Full media acceptance: external provider blocker

The separate full playback run45107452925 failed at the Welcome player:
https://github.com/souperbowltech-pixel/raypuenpublishing/actions/runs/45107452925

The captured screenshot shows YouTube's "Sign in to confirm you're not a bot"
challenge on the GitHub runner. Playback remained at0, paused=true, readyState0.
This is recorded as a failed external-media gate, not passed or silently skipped.
No challenge bypass was attempted. Verify all five films in an ordinary approved
browser/phone before release. The thirteen-check geometry job remains separately
successful; it deliberately blocks media and cannot substitute for this gate.

GitHub repository and Preview/Production environment secret-name listings were
checked: no service credentials are stored there. Supabase/Vercel account-owner
connection remains required for hosted operations. No secret values were read.
