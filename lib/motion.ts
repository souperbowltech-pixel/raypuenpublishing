/**
 * The decisions behind the site's entrance motion, kept apart from the DOM so
 * they are tested on their own.
 */

/**
 * How long a GSAP entrance may hold its words unseen while the script loads.
 * app/globals.css shows them after the same time; past it, the entrance is skipped.
 */
export const MOTION_FALLBACK_MS = 1500;

/** How many children of one group get their own delay; later ones share the last. */
export const REVEAL_STAGGER_CAP = 6;

/** One child's entrance, and the beat between children. app/globals.css uses the same numbers. */
export const REVEAL_DURATION_MS = 600;
export const REVEAL_STEP_MS = 70;

/**
 * When the whole group has finished entering. After this the entrance state is
 * taken off, so the children go back to their own hover and press timing.
 */
export const REVEAL_SETTLE_MS = REVEAL_DURATION_MS + REVEAL_STAGGER_CAP * REVEAL_STEP_MS + 100;

/**
 * Whether a group should wait off screen and enter when scrolled to.
 *
 * A group already in view at load is left alone: hiding it now would make
 * content the reader can already see blink out and back. Reduced motion means
 * no entrance at all.
 */
export function shouldDeferReveal(top: number, viewportHeight: number, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  if (!Number.isFinite(top) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return false;
  return top >= viewportHeight;
}

/** The stagger step for the child at `index`, capped so a long list does not crawl in. */
export function revealIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, REVEAL_STAGGER_CAP);
}
