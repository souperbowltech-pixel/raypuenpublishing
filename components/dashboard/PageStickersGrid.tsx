"use client";

import React, { useState } from "react";
import { stickerBadgePath } from "@/lib/gamification";
import { PAGE_STICKER_META } from "@/lib/stickers";

interface PageStickersGridProps {
  completedPages: number[];
  onTogglePage: (pageNumber: number) => void;
}

export default function PageStickersGrid({
  completedPages,
  onTogglePage,
}: PageStickersGridProps) {
  const completedCount = completedPages.length;
  const progressPercent = Math.round((completedCount / 19) * 100);

  // Track slots whose real merit-badge PNG hasn't been delivered yet, so we can
  // fall back to a coloured numbered placeholder instead of a broken image.
  const [missingBadges, setMissingBadges] = useState<Set<number>>(new Set());
  const markBadgeMissing = (n: number) =>
    setMissingBadges((prev) => (prev.has(n) ? prev : new Set(prev).add(n)));

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-6 sm:p-8 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5">
        <div>
          <span className="eyebrow">The Digital Mastery Ledger</span>
          <h3 className="mt-1 text-2xl font-bold font-display text-ink">
            19-Slot Digital Sticker Album
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Mark each page as you color! Completed pages instantly illuminate from grayscale to vibrant full-color.
          </p>
        </div>

        <div className="rounded-xl bg-paper-deep px-4 py-2 text-right border border-ink/10">
          <span className="text-xs font-bold text-ink-soft uppercase tracking-wider block">
            Sticker Album Progress
          </span>
          <span className="text-2xl font-black font-display text-spruce">
            {completedCount} / 19 Achieved ({progressPercent}%)
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="h-3.5 w-full overflow-hidden rounded-full bg-ink/10 p-0.5">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-clay via-crayon-gold to-spruce"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Master Sticker Sheet — server-generated PDF of all 19 badges for home printing */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-spruce/25 bg-spruce/5 p-3.5">
        <p className="text-xs sm:text-sm text-ink-soft">
          Print all 19 merit badges on one page — ready for adhesive sticker paper.
        </p>
        <a
          href="/api/stickers/sheet"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-spruce px-4 py-2 text-sm font-bold text-paper transition hover:bg-spruce-dark shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Master Sticker Sheet
        </a>
      </div>

      {/* 19 Digital Sticker Slots */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {PAGE_STICKER_META.map((page) => {
          const isAchieved = completedPages.includes(page.pageNumber);

          return (
            <div
              key={page.pageNumber}
              onClick={() => onTogglePage(page.pageNumber)}
              className={`group relative cursor-pointer rounded-xl border p-3.5 text-center transition-all duration-300 select-none flex flex-col justify-between ${
                isAchieved
                  ? "border-spruce/50 bg-paper shadow-md ring-2 ring-spruce/30 scale-[1.02]"
                  : "border-ink/10 bg-paper-deep/60 opacity-60 grayscale hover:opacity-85 hover:border-ink/20"
              }`}
            >
              {/* Badge Slot */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-2">
                  <span className={`px-1.5 py-0.5 rounded ${isAchieved ? "bg-spruce text-paper" : "bg-ink/10 text-ink-soft"}`}>
                    P.{page.pageNumber}
                  </span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isAchieved ? "text-spruce font-black" : "text-ink-soft"}`}>
                    {isAchieved ? "Achieved" : "Locked"}
                  </span>
                </div>

                {/* Merit Badge — full-colour PNG when achieved; gray numbered silhouette when locked */}
                <div className="mx-auto h-16 w-16 transition-transform duration-300 group-hover:scale-110">
                  {isAchieved && !missingBadges.has(page.pageNumber) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stickerBadgePath(page.pageNumber)}
                      alt={`${page.virtue} merit badge`}
                      className="h-16 w-16 object-contain drop-shadow-sm"
                      onError={() => markBadgeMissing(page.pageNumber)}
                    />
                  ) : (
                    <div
                      className={`h-16 w-16 rounded-full flex items-center justify-center font-display font-black text-xl shadow-sm bg-gradient-to-br ${
                        isAchieved
                          ? `${page.gradient} text-white`
                          : "from-gray-300 to-gray-400 text-gray-600"
                      }`}
                    >
                      {page.pageNumber}
                    </div>
                  )}
                </div>

                <h4 className="mt-2 text-xs font-bold text-ink line-clamp-1 font-display">
                  {page.virtue}
                </h4>
              </div>

              {/* Action Button */}
              <button
                type="button"
                className={`mt-3 w-full rounded-md py-1.5 text-[11px] font-bold transition ${
                  isAchieved
                    ? "bg-spruce/15 text-spruce-dark hover:bg-spruce/25"
                    : "bg-clay text-paper hover:bg-clay-dark"
                }`}
              >
                {isAchieved ? "✓ Completed" : "I Completed This!"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
