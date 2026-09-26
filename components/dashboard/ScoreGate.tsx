"use client";

import React from "react";
import {
  BOOK2_GATE_CONFIG,
  getMainPanelCopy,
  getUnlockedPanelCopy,
} from "@/lib/gamification";

interface ScoreGateProps {
  totalScore: number;
  quizScore: number;
  referralScore: number;
  scoutName: string;
}

export default function ScoreGate({
  totalScore,
  quizScore,
  referralScore,
  scoutName,
}: ScoreGateProps) {
  const percentage = Math.min(100, Math.round((totalScore / 700) * 100));
  const hasAcademicPass = quizScore >= BOOK2_GATE_CONFIG.academicPassThreshold;
  const isBook2Unlocked = totalScore >= BOOK2_GATE_CONFIG.unlockThreshold;

  const handlePrintRibbon = () => {
    window.print();
  };

  return (
    <div className="rounded-2xl border-2 border-clay/30 bg-paper-deep p-6 sm:p-8 shadow-card">
      <div className="rounded-xl bg-gradient-to-r from-clay via-clay-dark to-spruce p-4 sm:p-5 text-center text-paper shadow-md">
        <span className="inline-block rounded-full bg-paper/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-paper mb-2">
          Gate Milestone
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wide font-display text-white">
          {isBook2Unlocked ? BOOK2_GATE_CONFIG.unlockedHeaderBanner : BOOK2_GATE_CONFIG.headerBanner}
        </h2>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
          <div>
            <span className="eyebrow">Scout Score Progress</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-ink font-display">
                {totalScore}
              </span>
              <span className="text-lg font-bold text-ink-soft">/ 700 Points</span>
            </div>
          </div>
          <div className="text-right">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider shadow-sm"
              style={{
                backgroundColor: isBook2Unlocked ? "#2E6B5E" : hasAcademicPass ? "#E4A93C" : "#5A5148",
                color: "#FCF8F1",
              }}
            >
              {isBook2Unlocked ? "🌟 Status: Unlock_Volume_2" : hasAcademicPass ? "📜 Status: Academic_Pass" : "🧭 Status: In_Progress"}
            </span>
          </div>
        </div>

        <div className="relative h-6 w-full overflow-hidden rounded-full bg-ink/10 p-1">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-clay via-crayon-gold to-spruce"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs font-bold text-ink-soft">
          <span>0 pts</span>
          <span className={hasAcademicPass ? "text-spruce font-black" : ""}>
            400 pts (Quiz Pass)
          </span>
          <span className={isBook2Unlocked ? "text-spruce-dark font-black" : ""}>
            700 pts (Book 2 Unlock)
          </span>
        </div>
      </div>

      {hasAcademicPass && (
        <div className="mt-6 rounded-xl border border-spruce/30 bg-spruce/10 p-5">
          <div className="flex items-start gap-3.5">
            <div className="text-2xl sm:text-3xl">🎖️</div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-spruce-dark font-display">
                {isBook2Unlocked ? BOOK2_GATE_CONFIG.unlockedPanelTitle : "Academic Points Secured!"}
              </h3>
              <p className="mt-1 text-sm sm:text-base leading-relaxed text-ink-soft">
                {isBook2Unlocked ? getUnlockedPanelCopy(scoutName) : getMainPanelCopy(scoutName)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintRibbon}
                  className="inline-flex items-center gap-2 rounded-lg bg-spruce px-4 py-2 text-sm font-bold text-paper transition hover:bg-spruce-dark shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Your Digital Coloring Ribbon
                </button>
                <span className="text-xs text-spruce font-medium">
                  Ribbon verified for {scoutName ? `Chief Explorer ${scoutName}` : "Chief Explorer"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
