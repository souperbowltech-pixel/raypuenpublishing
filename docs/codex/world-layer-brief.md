# Brief for Codex: add a "world" to the storefront (do not redesign)

## Goal

The storefront at `/` (`app/page.tsx`) sells the children's book *The Adventures of Geezy Goober*.
Keep every section, every word and the layout as they are. Add a layer of handmade 3D felt
characters and papier-mache scenery on top, so the page feels like a little world: characters peek
out from behind things and pop into view as the visitor scrolls. Think "add a world", not a new
design.

The images are already made and live in `public/world/` (list below). Use only those files. If a
file in the list is missing, leave that placement out; never use a placeholder or a stock image.

## Rules (read before writing code)

1. Work on a new branch `world-layer` from `main`. Do not merge, do not push to `main`, do not deploy.
2. Read `CLAUDE.md` in the repo root: its build rules, QA gate and forbidden list apply to you too.
   Never edit anything inside `.claude/`. Never commit `files from ray/` or `refrence video/`.
3. **No new dependencies.** GSAP is already installed: load it only through
   `components/motion/load-gsap.ts` (`loadGsap`, `loadScrollGsap`). Tailwind already has the
   `pop-in`, `wiggle` and `stamp` animations (`tailwind.config.ts`) and there is a `Reveal`
   component (`components/ui/Reveal.tsx`). Follow how `components/motion/CoverParallax.tsx` and
   `components/motion/CountUp.tsx` are written, including their tests.
4. **Decoration only.** Every character and scene image is decorative: `alt=""`, `aria-hidden`,
   `pointer-events-none`, never in the tab order, never covering a button, a link or text.
5. **Nothing hidden without JavaScript.** The page must read and look complete before any script
   runs. A character may start a little lower or smaller and animate into place, but never start
   invisible in the server HTML.
6. **Reduced motion:** under `prefers-reduced-motion: reduce` every character is simply shown in
   place, with no movement.
7. **No layout shift.** Characters are absolutely positioned inside a `relative` parent, with fixed
   width and height on `next/image`. Section heights must not change (measure before and after).
8. **Speed.** Only the hero character may load eagerly; every other image `loading="lazy"`.
   Animate only `transform` and `opacity`. Keep the hero cover the largest image on first paint.
9. **Phones.** At 375 px wide: no horizontal scroll, no character over text. Make characters
   smaller or hide the less important ones below `sm`.
10. Plain English in any comment or text. No em dashes or en dashes anywhere.

## Images and where they go

| File in `public/world/` | Where | Behaviour |
|---|---|---|
| `geezy-peek.png` | `components/retail/Hero.tsx`, peeking from behind the left edge of the book cover | After load, slides out 20 to 30 px with a small overshoot (the `pop-in` feel), then a slow gentle sway. Eager load. |
| `owl.png` | Perched on the top edge of the virtue strip (`components/motion/VirtueMarquee.tsx`) | Fixed in place, a small `wiggle` once when the strip scrolls into view. |
| `bg-twirl-woods.png` | Behind `components/retail/IllustrationGallery.tsx`, soft and low contrast | Slow parallax with scroll (much gentler than the cover's). Must not reduce text contrast. |
| `bear.png` | Rising from the bottom edge of `components/retail/BookDetails.tsx` | Pops up once when the section enters view (ScrollTrigger, once), with follow-through. |
| `explorer.png` | Beside `components/retail/AboutAuthor.tsx` | Walks in a short way from the side when the section enters view, once. |
| `geezy-wave.png` | Near the buy box (`components/retail/BuyBox.tsx`) | Waves (small rotate back and forth) once when the buy box enters view. Must not sit over the buttons. |
| `paper-texture.png` | Very light background texture on the page body sections | Static, tiled, low opacity. Text contrast must stay at or above WCAG AA. |
| `bg-hill-path.png`, `bg-lantern-night.png`, `sunny-fairy.png`, `david.png` | Not used in this pass | Leave them for later pages. |

Put shared pieces in `components/world/` (for example one `WorldCharacter` component that takes
the image, size, position and entrance), and one list of placements in `lib/world.ts`, so the
whole layer can be switched off in one place.

## Tests and checks (all must pass before you stop)

- Unit and DOM tests in the style of `components/motion/*.dom.test.tsx`: images are decorative
  (`alt=""`, `aria-hidden`), present in the server HTML without JS, no animation under reduced
  motion, ScrollTrigger runs once.
- `npm run lint`, `npm run typecheck`, `npm run test`: zero new errors, paste the real output.
- Do not delete, skip or weaken an existing test.
- Do not run `npm run build` while a dev server is running.

## When you finish

Commit on `world-layer` in small commits, one per section, message `feat(world): <section>`.
Write a short report: what was added where, test output, anything you could not do, and a list of
screenshots or the steps to see each placement. Do not merge or deploy; Claude reviews the branch
and the user shows it to Ray first.
