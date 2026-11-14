"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { loadGsap } from "@/components/motion/load-gsap";
import { CountUp } from "@/components/motion/CountUp";
import { PAGE_STICKER_META } from "@/lib/stickers";
import { stickerBadgePath } from "@/lib/gamification";

export interface VirtueBadge {
  label: string;
  src: string;
}

/** The book's virtues in page order, each with its badge: what the storefront shows. */
export const BOOK1_VIRTUE_BADGES: VirtueBadge[] = PAGE_STICKER_META.map((page) => ({
  label: page.virtue,
  src: stickerBadgePath(page.pageNumber),
}));

/** Seconds for the strip to travel one full copy of the list. */
export const MARQUEE_LOOP_SECONDS = 45;

interface Loop {
  pause: () => void;
  play: () => void;
}

type Ref<T> = { current: T };

/** Plays only when the reader has not paused it, it can be seen, and no mouse rests on it. */
function syncLoop(loop: Ref<Loop | null>, paused: Ref<boolean>, visible: Ref<boolean>, hovered: Ref<boolean>) {
  if (paused.current || !visible.current || hovered.current) loop.current?.pause();
  else loop.current?.play();
}

/**
 * A slow, endless strip of the book's virtue badges (GSAP, linear repeat).
 *
 * The list is rendered twice once moving, so the loop has no seam; screen
 * readers get the first copy only. Anything that moves on its own for more
 * than five seconds must be pausable (WCAG 2.2.2), so there is a Pause button;
 * the strip also rests under a mouse pointer and whenever it is off screen.
 * For reduced motion it is a still list that wraps, so every virtue shows.
 * Before script it is a single row that can be scrolled, by keyboard too.
 */
export function VirtueMarquee({ badges }: { badges: VirtueBadge[] }) {
  const area = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const loop = useRef<Loop | null>(null);
  const [moving, setMoving] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const visibleRef = useRef(true);
  const hoveredRef = useRef(false);

  const sync = () => syncLoop(loop, pausedRef, visibleRef, hoveredRef);

  useEffect(() => {
    const strip = track.current;
    if (!strip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let revert: (() => void) | undefined;
    let observer: IntersectionObserver | undefined;
    loadGsap()
      .then(({ gsap }) => {
        if (cancelled) return;
        const ctx = gsap.context(() => {
          loop.current = gsap.to(strip, { xPercent: -50, duration: MARQUEE_LOOP_SECONDS, ease: "none", repeat: -1 });
        }, strip);
        revert = () => ctx.revert();
        if (typeof IntersectionObserver !== "undefined" && area.current) {
          observer = new IntersectionObserver((entries) => {
            visibleRef.current = entries.some((entry) => entry.isIntersecting);
            syncLoop(loop, pausedRef, visibleRef, hoveredRef);
          });
          observer.observe(area.current);
        }
        syncLoop(loop, pausedRef, visibleRef, hoveredRef);
        setMoving(true);
      })
      .catch((error: unknown) => {
        // The strip simply stays still; nothing on the page depends on it.
        console.warn("Virtue strip motion unavailable", error);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      loop.current = null;
      revert?.();
    };
  }, []);

  const toggle = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    sync();
  };

  // A tap on a phone is not a hover: only a real mouse rests the strip.
  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    hoveredRef.current = true;
    sync();
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    hoveredRef.current = false;
    sync();
  };

  const row = (copy: number) => (
    <ul
      className="flex shrink-0 items-center gap-8 pr-8 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-4 motion-reduce:pr-0"
      aria-hidden={copy > 0 ? true : undefined}
    >
      {badges.map((badge) => (
        <li key={`${copy}-${badge.src}`} className="flex shrink-0 items-center gap-2.5">
          <Image src={badge.src} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
          <span className="font-display text-lg font-semibold text-ink">{badge.label}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-labelledby="virtues-heading" className="border-y border-ink/10 bg-paper-deep py-6">
      {/* Tall enough for the button from the start, so its arrival moves nothing. */}
      <div className="container-page flex min-h-11 items-center justify-between gap-4">
        <h2 id="virtues-heading" className="eyebrow">
          <CountUp value={badges.length} /> virtues to color in Book 1
        </h2>
        {moving && (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={paused}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-soft underline hover:text-ink"
          >
            {paused ? "Play" : "Pause"}
            <span className="sr-only"> the moving list of virtues</span>
          </button>
        )}
      </div>
      {/* Still, it is a row that scrolls sideways (keyboard included); moving, the
          second copy closes the loop. Same height either way, so nothing jumps.
          For reduced motion the list wraps instead and nothing needs scrolling. */}
      <div
        ref={area}
        className={`mt-4 pl-5 sm:pl-8 motion-reduce:px-5 motion-reduce:sm:px-8 ${
          moving ? "overflow-hidden" : "overflow-x-auto [scrollbar-width:none] motion-reduce:overflow-visible"
        }`}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        {...(moving ? {} : { tabIndex: 0, role: "region", "aria-label": "Virtues in Book 1" })}
      >
        {/* No padding on the track itself: -50% must be exactly one copy for a seamless loop. */}
        <div ref={track} className="flex w-max motion-reduce:block motion-reduce:w-auto">
          {row(0)}
          {moving && row(1)}
        </div>
      </div>
    </section>
  );
}
