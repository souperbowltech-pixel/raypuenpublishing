"use client";

import React from "react";
import { BOOK2_CONTINUATION_BANNER } from "@/lib/gamification";

/**
 * Rule 2 — the Book 2 Continuation Hook. A persistent, encouraging banner shown
 * at the very top of the dashboard when a Scout has advanced to Book 2 but no
 * adult relative has sponsored yet. It nudges (never blocks) the Grandpa path.
 */
export default function Book2ContinuationBanner() {
  return (
    <div
      role="status"
      className="rounded-2xl border-2 border-crayon-gold bg-gradient-to-r from-crayon-goldsoft/60 via-paper to-clay/10 p-4 sm:p-5 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl sm:text-3xl shrink-0" aria-hidden="true">
          💛
        </span>
        <p className="text-sm sm:text-base font-semibold leading-relaxed text-ink">
          {BOOK2_CONTINUATION_BANNER}
        </p>
      </div>
    </div>
  );
}
