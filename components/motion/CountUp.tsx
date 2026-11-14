"use client";

import { useEffect, useRef } from "react";
import { loadScrollGsap } from "@/components/motion/load-gsap";

/** How long a number takes to count up once it scrolls into view. */
export const COUNT_UP_SECONDS = 1.2;

/**
 * A number that counts up from 0 when it first scrolls into view (GSAP
 * ScrollTrigger, once).
 *
 * One span holds the real number, so copying, search engines and screen
 * readers all get "36", never a doubled "3636"; there is no live region, so
 * the ticking digits are not announced. It stays the real number unless the
 * count actually runs: a number already on screen or scrolled past, reduced
 * motion, or GSAP failing leave it as it is. The span keeps the width of the
 * final number so the words beside it do not slide while it counts, and a new
 * value gives a fresh span, so an old count can never overwrite it.
 */
export function CountUp({ value }: { value: number }) {
  return <Digits key={value} value={value} />;
}

function Digits({ value }: { value: number }) {
  const span = useRef<HTMLSpanElement>(null);
  const final = String(value);

  useEffect(() => {
    const digits = span.current;
    if (!digits || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // In view or already passed: counting now would replace a number the reader has seen.
    if (digits.getBoundingClientRect().top < window.innerHeight) return;

    let cancelled = false;
    let revert: (() => void) | undefined;
    loadScrollGsap()
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;
        const ctx = gsap.context(() => {
          ScrollTrigger.create({
            trigger: digits,
            // A little way in, so a section that fades in on arrival is visible for the count.
            start: "top 80%",
            once: true,
            onEnter: () => {
              const count = { n: 0 };
              // Hold the real number's measured width (letter-spacing included) while it counts.
              digits.style.minWidth = `${digits.getBoundingClientRect().width}px`;
              digits.textContent = "0";
              gsap.to(count, {
                n: value,
                duration: COUNT_UP_SECONDS,
                ease: "power2.out",
                onUpdate: () => {
                  digits.textContent = String(Math.round(count.n));
                },
                onComplete: () => {
                  digits.textContent = final;
                },
              });
            },
          });
        }, digits);
        revert = () => ctx.revert();
      })
      .catch((error: unknown) => {
        // The real number is already shown; only the count is lost.
        console.warn("Count-up unavailable", error);
      });

    return () => {
      cancelled = true;
      revert?.();
      digits.textContent = final;
    };
  }, [value, final]);

  return (
    <span
      ref={span}
      className="inline-block text-right tabular-nums"
      style={{ minWidth: `${final.length}ch` }}
    >
      {final}
    </span>
  );
}
