"use client";

import React from "react";
import Image from "next/image";
import { BOOK2_CONTINUATION_BANNER } from "@/lib/gamification";

/**
 * Rule 2 — the Book 2 Continuation Hook. A persistent, encouraging banner shown
 * at the very top of the dashboard when a Scout has advanced to Book 2 but no
 * adult relative has sponsored yet. It nudges (never blocks) the Grandpa path.
 *
 * The cover is the illustrator's real Book 2 artwork rather than a placeholder:
 * a child is being asked to work toward this book, so it helps to see it.
 */
export default function Book2ContinuationBanner() {
  return (
    <div
      role="status"
      className="rounded-2xl border-2 border-crayon-gold bg-gradient-to-r from-crayon-goldsoft/60 via-paper to-clay/10 p-4 sm:p-5 shadow-card"
    >
      <div className="flex items-center gap-4">
        <Image
          src="/book2-cover.jpg"
          alt="Front cover of The Wiggly Wump's Whistling Waves to Icky Sfand, Volume 2"
          width={721}
          height={946}
          className="h-24 w-auto shrink-0 rounded-lg shadow-card sm:h-28"
          priority={false}
        />
        <p className="text-sm sm:text-base font-semibold leading-relaxed text-ink">
          {BOOK2_CONTINUATION_BANNER}
        </p>
      </div>
    </div>
  );
}
