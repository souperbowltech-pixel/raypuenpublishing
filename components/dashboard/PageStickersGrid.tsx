"use client";

import React, { useState } from "react";

export interface PageSlotInfo {
  pageNumber: number;
  title: string;
  virtue: string;
  icon: string;
  gradient: string;
}

export const BOOK2_PAGES: PageSlotInfo[] = [
  { pageNumber: 1, title: "The Burlap Sack Escape", virtue: "Humility", icon: "🎒", gradient: "from-amber-400 to-orange-500" },
  { pageNumber: 2, title: "The Hidden Green Mountain", virtue: "Perseverance", icon: "⛰️", gradient: "from-emerald-400 to-teal-600" },
  { pageNumber: 3, title: "Grumble-Grip's Perch", virtue: "Patience", icon: "🦅", gradient: "from-blue-400 to-indigo-600" },
  { pageNumber: 4, title: "Sunny Fairy's Golden Crown", virtue: "Joy", icon: "✨", gradient: "from-yellow-300 to-amber-500" },
  { pageNumber: 5, title: "Pink Bubble-Glue Lake", virtue: "Courage", icon: "🌊", gradient: "from-pink-400 to-rose-600" },
  { pageNumber: 6, title: "Barnaby Bingle's Crew", virtue: "Teamwork", icon: "🐻", gradient: "from-amber-600 to-stone-700" },
  { pageNumber: 7, title: "The Wild Blueprint Map", virtue: "Vision", icon: "📜", gradient: "from-teal-400 to-cyan-600" },
  { pageNumber: 8, title: "Giant Button Submarine", virtue: "Creativity", icon: "🧵", gradient: "from-violet-400 to-purple-600" },
  { pageNumber: 9, title: "Whistling Sea-Shell Melody", virtue: "Harmony", icon: "🐚", gradient: "from-cyan-300 to-blue-500" },
  { pageNumber: 10, title: "Gentle Orange Octopus", virtue: "Kindness", icon: "🐙", gradient: "from-orange-400 to-red-500" },
  { pageNumber: 11, title: "The Carved Wooden Key", virtue: "Faithfulness", icon: "🗝️", gradient: "from-yellow-500 to-amber-700" },
  { pageNumber: 12, title: "The Sea-Sheller's Secret Den", virtue: "Focus", icon: "🏝️", gradient: "from-emerald-500 to-green-700" },
  { pageNumber: 13, title: "The Throne of Solid Stone", virtue: "Reverence", icon: "👑", gradient: "from-purple-500 to-indigo-800" },
  { pageNumber: 14, title: "Tickle-Squid's Lace Mustache", virtue: "Laughter", icon: "🦑", gradient: "from-green-400 to-emerald-600" },
  { pageNumber: 15, title: "Rolling on the Water", virtue: "Fellowship", icon: "🎈", gradient: "from-rose-400 to-red-600" },
  { pageNumber: 16, title: "Rare Blue & Tan Paint-Rocks", virtue: "Truth", icon: "💎", gradient: "from-sky-400 to-blue-600" },
  { pageNumber: 17, title: "Feathers of Tan & Blue", virtue: "Grace", icon: "🪶", gradient: "from-amber-300 to-yellow-600" },
  { pageNumber: 18, title: "The Goober's Words Unbound", virtue: "Freedom", icon: "🕊️", gradient: "from-sky-300 to-indigo-500" },
  { pageNumber: 19, title: "The Master Scout Circle", virtue: "Love", icon: "🌟", gradient: "from-yellow-400 via-orange-500 to-red-500" },
];

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

      {/* 19 Digital Sticker Slots */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {BOOK2_PAGES.map((page) => {
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

                {/* Sticker Icon Circle */}
                <div
                  className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center text-3xl shadow-sm transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br ${
                    isAchieved ? page.gradient : "from-gray-300 to-gray-400"
                  }`}
                >
                  <span className="drop-shadow-sm">{page.icon}</span>
                </div>

                <h4 className="mt-2 text-xs font-bold text-ink line-clamp-1 font-display">
                  {page.title}
                </h4>
                <p className="text-[11px] font-semibold text-spruce">
                  {page.virtue}
                </p>
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
