"use client";

import { Fragment, useEffect, useRef } from "react";
import { MOTION_FALLBACK_MS } from "@/lib/motion";
import { loadGsap } from "@/components/motion/load-gsap";

/** True until a title has run its entrance once in this page load. */
let firstTitleOfPage = true;

interface HeroTitleProps {
  text: string;
  className?: string;
}

/**
 * The storefront headline, its words rising into place one after another
 * when the page opens (GSAP, staggered timeline).
 *
 * The words are separate spans from the server, so nothing is measured or
 * re-split in the browser. While the script loads they are held invisible by
 * app/globals.css, but only when JavaScript is running (html.js), and never
 * for longer than MOTION_FALLBACK_MS, so a failed download cannot leave the
 * page without its title. If GSAP arrives after that, the title is left as it
 * is rather than hidden and raised a second time. Reduced motion shows the
 * title at once. Screen readers get the whole title from aria-label.
 */
export function HeroTitle({ text, className }: HeroTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const words = text.split(/\s+/).filter(Boolean);

  useEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    const finish = () => {
      heading.dataset.motion = "done";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    // The CSS fallback's clock starts when the title is first styled: at the
    // first paint of a fresh page load, or when it is inserted on an in-site
    // visit back to the storefront. Measure against the same moment.
    const clockStart = firstTitleOfPage ? 0 : performance.now();
    firstTitleOfPage = false;

    let cancelled = false;
    let revert: (() => void) | undefined;
    loadGsap()
      .then(({ gsap }) => {
        if (cancelled) return;
        // Too late: the CSS fallback has already shown the words.
        if (performance.now() - clockStart >= MOTION_FALLBACK_MS) {
          finish();
          return;
        }
        const ctx = gsap.context(() => {
          gsap.fromTo(
            heading.querySelectorAll("[data-word] > span"),
            { yPercent: 110, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.08, onComplete: finish }
          );
        }, heading);
        revert = () => ctx.revert();
      })
      .catch(finish);

    return () => {
      cancelled = true;
      // Only a tween that ran needs undoing; React's development re-run must
      // find the title still waiting, not already shown.
      if (revert) {
        revert();
        finish();
      }
    };
  }, []);

  return (
    <h1 ref={ref} className={className} aria-label={text} data-motion="waiting">
      {words.map((word, i) => (
        <Fragment key={i}>
          <span data-word aria-hidden="true" className="inline-block overflow-hidden pb-[0.1em] align-bottom">
            <span className="inline-block">{word}</span>
          </span>
          {/* Outside the word box, so it is a real gap and a place the line may break. */}
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </h1>
  );
}
