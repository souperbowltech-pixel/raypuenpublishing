"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { loadScrollGsap } from "@/components/motion/load-gsap";

/**
 * The storefront book cover drifts up and turns a little as the reader
 * scrolls past the hero, tied to the scroll position (GSAP ScrollTrigger,
 * scrub), so it moves only as fast as the reader does.
 *
 * Nothing is hidden or waiting: the cover sits in its normal place until the
 * script arrives, and stays there if it never does or the reader prefers
 * reduced motion. Only this wrapper moves, so the cover's own tilt is kept.
 *
 * It must sit inside the hero's <section>: the motion is measured across that
 * section. The first stretch of scroll, while the section top passes under the
 * sticky header, moves nothing on purpose, so the cover is still on arrival.
 */
export function CoverParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cover = ref.current;
    if (!cover || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let revert: (() => void) | undefined;
    loadScrollGsap()
      .then(({ gsap }) => {
        if (cancelled) return;
        const ctx = gsap.context(() => {
          gsap.to(cover, {
            yPercent: -12,
            rotate: -4,
            ease: "none",
            scrollTrigger: {
              trigger: cover.closest("section") ?? cover,
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          });
        }, cover);
        revert = () => ctx.revert();
      })
      .catch((error: unknown) => {
        // The cover simply stays still; nothing on the page depends on this.
        console.warn("Cover scroll motion unavailable", error);
      });

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
