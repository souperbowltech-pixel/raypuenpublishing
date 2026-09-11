"use client";

import React, { useState } from "react";
import Link from "next/link";
import ScoreGate from "@/components/dashboard/ScoreGate";
import ComprehensionQuiz from "@/components/dashboard/ComprehensionQuiz";
import QuestCaptainBox from "@/components/dashboard/QuestCaptainBox";
import Volume3UnlockCard from "@/components/dashboard/Volume3UnlockCard";
import { BOOK2_GATE_CONFIG } from "@/lib/gamification";

export default function Book2DashboardPage() {
  const [scoutName, setScoutName] = useState("Scout Explorer");
  const [quizScore, setQuizScore] = useState(0);
  const [referralScore, setReferralScore] = useState(0);
  const referralCode = "CAPTAIN-RAY-700";

  const totalScore = quizScore + referralScore;
  const hasPassedQuiz = quizScore >= BOOK2_GATE_CONFIG.academicPassThreshold;
  const hasFriendRecruited = referralScore >= BOOK2_GATE_CONFIG.friendReferralPoints;
  const isUnlocked = totalScore >= BOOK2_GATE_CONFIG.unlockThreshold;

  return (
    <div className="min-h-screen bg-paper text-ink pb-20">
      <header className="border-b border-ink/10 bg-paper-deep/80 backdrop-blur sticky top-0 z-20">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-display text-lg sm:text-xl font-bold text-ink hover:text-clay transition"
            >
              Puen Publishing
            </Link>
            <span className="text-xs font-mono font-bold text-spruce bg-spruce/10 px-2.5 py-0.5 rounded-full">
              Scout Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs sm:text-sm font-semibold text-ink-soft hover:text-ink transition"
            >
              ← Back to Storefront
            </Link>
          </div>
        </div>
      </header>

      <main className="container-page mt-8 space-y-8 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-paper-deep p-4 sm:p-6 border border-ink/10">
          <div>
            <span className="eyebrow">Scout Profile</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl">🧭</span>
              <input
                type="text"
                value={scoutName}
                onChange={(e) => setScoutName(e.target.value)}
                className="font-display text-xl sm:text-2xl font-bold bg-transparent border-b border-dashed border-ink/30 focus:outline-none focus:border-spruce text-ink"
                title="Click to customize scout name"
              />
            </div>
          </div>
          <div className="text-xs text-ink-soft sm:text-right">
            <span>Logged in as Verified Reader</span>
            <span className="block font-mono font-bold text-spruce">ID: {referralCode}</span>
          </div>
        </div>

        <ScoreGate
          totalScore={totalScore}
          quizScore={quizScore}
          referralScore={referralScore}
          scoutName={scoutName}
        />

        <ComprehensionQuiz
          currentQuizScore={quizScore}
          onScoreUpdate={(s) => setQuizScore(s)}
          bookNumber={2}
        />

        <QuestCaptainBox
          hasFriendRecruited={hasFriendRecruited}
          referralCode={referralCode}
          hasPassedQuiz={hasPassedQuiz}
          onSimulateReferral={() => setReferralScore(300)}
          onResetReferral={() => setReferralScore(0)}
        />

        {isUnlocked && <Volume3UnlockCard scoutName={scoutName} />}
      </main>
    </div>
  );
}
