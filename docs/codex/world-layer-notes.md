# World layer implementation and review notes

The approved scope is the existing world layer brief. Storefront words, section
order, spacing and flow stay as they are. All artwork is local and decorative.

## Mini-specs written before implementation

Shared character: accepts a typed local image placement with fixed dimensions,
responsive position, image sizes and an entrance name. It returns an absolutely
positioned, inert image that is visible in server HTML. It uses the existing GSAP
loaders. Missing placements and a disabled central switch render nothing. A failed
image is removed; a failed animation logs a warning and leaves the image still.
Reduced motion and CSS-hidden placements load no animation. A media query change
reverts active animation. Unmount cancels deferred loading and reverts GSAP.
There are five fixed character placements, no user input or remote image URLs,
no database calls, no shared mutable animation state, and no work proportional to
visitor count. GSAP context owns each instance's cleanup.

Hero: Geezy peeks from behind the cover, slides 24 px with overshoot, then sways
gently and settles. The whole movement finishes within five seconds. It is the
only eager world image and is smaller than the cover at every breakpoint.

Virtue strip: the owl perches in the top padding, away from the heading and pause
control. A finite wiggle runs once on section entry. The existing strip's motion,
controls, keyboard access and tests stay intact.

Gallery scene: a lazy woods image sits behind the existing gallery in an isolated,
clipped layer. Its scroll drift is much smaller than the cover's. Its opacity is
bounded to preserve the existing text contrast. Failure leaves the normal page.

Book details: a clipped bear rises once in the existing bottom padding. Neither
the content grid nor section height changes. It is hidden on narrow screens.

Author: an explorer walks a short distance once beside the author card. Its
responsive placement uses free space and is hidden where space is insufficient.

Buy box: a small Geezy sits outside the purchase card and waves once when the
card enters view. It never overlaps any quantity, checkout, error or price text.
It is hidden on phones if the remaining gutter is too small.

Paper: a static, very faint repeating texture decorates only storefront body
sections. It changes neither text opacity nor content positioning. Disabling the
same central switch removes the complete world layer.

Checks cover server markup, decorative semantics, loading priority, motion
preferences, once-only scroll entrances, cancelled loads, cleanup and failures.
Browser checks compare section heights and words with the unmodified page at
375, 768, 1280 and 1536 px with normal motion, reduced motion and JavaScript off.
No dependencies, authentication paths or payment behavior change.

## Completed checks

All seven specified placements are present: hero, owl, woods, bear, explorer,
waving Geezy and paper. The four reserved images remain unused. The paper first
uses a lazy Next image; once decoded, its existing URL is repeated as a static
background, with no additional image request. A noscript tile covers the same
area when JavaScript is off. The single WORLD_LAYER.enabled switch removes all
decorations and their image requests.

Browser comparison passed at 375, 768, 1280 and 1536 px, each with normal motion,
reduced motion and JavaScript disabled. All six section heights and visible words
match the baseline exactly. No scenario has horizontal overflow. The desktop
normal-motion heights, in section order, are 779.59375, 150, 544, 482, 464 and
182.25 px. The 375 px normal-motion heights are 1138.375, 150, 624, 924.5, 838
and 492 px. Reduced motion keeps the original virtue list wrapping behavior.
Screenshots were inspected for the hero, gallery, details and author sections.

The contrast test uses the actual Tailwind palette and assumes that both the
scene and texture were entirely black. Small text still exceeds 4.5:1. Real
GSAP tests verify that ScrollTrigger is registered, that character entry uses
once, and that leaving reverts the actual transforms and removes scroll links.

Final commands and results:

```text
npm.cmd run lint
> next lint
Exit 0. One pre-existing warning at components/ui/Lightbox.test.tsx:17:60.
No new warnings or errors.

npm.cmd run typecheck
> tsc --noEmit
Exit 0. No errors.

npm.cmd run test -- --maxWorkers=2 --minWorkers=1
 Test Files  87 passed (87)
      Tests  939 passed (939)
```

All tests run. Two workers avoid the memory exhaustion seen with the default
worker count on this machine; no test or test configuration was changed to
skip or weaken coverage. Package files are unchanged. npm ci succeeded using
a cache under analysis/world-layer because the default user cache is read-only.
The existing dependency tree reported 19 vulnerabilities: 9 moderate, 7 high,
3 critical. No dependency versions were changed under the no-new-dependencies
instruction. No production build was needed; the dev server was used alone.

## How to review visually

Run the existing dev command, open /, and inspect at 1280 px or wider. Geezy
peeks beside the book and another Geezy stands outside the buy card. Scroll to
the virtue strip for the owl, gallery for the soft woods, details for the bear
at the bottom edge, and the author card for the explorer below its right side.
The texture is deliberately faint behind the body sections. At 375 px only the
hero character remains; all text and controls retain their space. Repeat with
reduced motion and JavaScript disabled. Set WORLD_LAYER.enabled to false in
lib/world.ts to remove the entire layer.

Local evidence is under analysis/world-layer: before.json, after.json, the three
final check logs, images.json, and screenshots named 375-section-0.png through
375-section-5.png, with the same six images at 1280 and 1536 px. These review
artifacts are ignored by Git.

## Commit limitation

No commits could be created. git add and git commit failed to create index.lock
because the actual worktree metadata is outside the writable workspace. No
permission escalation is available in this session. Eight ordered patches under
analysis/world-layer/commit-series preserve the intended commits: images, hero,
virtues, gallery, details, author, buy-box and paper. The local image prompt file
is excluded. Branch world-layer is unchanged, with no push, merge or deployment.
