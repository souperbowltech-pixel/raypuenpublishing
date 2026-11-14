"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { REVEAL_SETTLE_MS, revealIndex, shouldDeferReveal } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * A group whose children enter together, one short beat apart, the first time
 * the group is scrolled into view.
 *
 * The server renders the children plainly visible. Only after hydration, and
 * only if the group starts below the fold, is it marked "pending" (hidden by
 * app/globals.css) and then "shown". So the page reads in full without
 * JavaScript, and nothing the reader can already see disappears. Once the
 * entrance has played, the state is removed again, so a card or button inside
 * keeps its own hover and press timing.
 *
 * Children are numbered for the stagger when the group mounts; any added later
 * enter with the first beat.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!shouldDeferReveal(node.getBoundingClientRect().top, window.innerHeight, reduced)) return;

    const children = Array.from(node.children) as HTMLElement[];
    let settleTimer: number | undefined;

    // Back to plain markup: no hiding, no entrance transition, no stagger.
    const settle = () => {
      delete node.dataset.reveal;
      children.forEach((child) => child.style.removeProperty("--reveal-i"));
    };

    children.forEach((child, index) => child.style.setProperty("--reveal-i", String(revealIndex(index))));
    node.dataset.reveal = "pending";

    // No margin: a short group at the very end of the page must still count as
    // reached when it is fully in view, or it would stay hidden.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        node.dataset.reveal = "shown";
        settleTimer = window.setTimeout(settle, REVEAL_SETTLE_MS);
      }
    });
    observer.observe(node);

    // Leaving the page, or React's development double mount, must never leave it hidden.
    return () => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      settle();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
