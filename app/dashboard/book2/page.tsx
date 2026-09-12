"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ScoreGate from "@/components/dashboard/ScoreGate";
import ComprehensionQuiz from "@/components/dashboard/ComprehensionQuiz";
import QuestCaptainBox from "@/components/dashboard/QuestCaptainBox";
import Volume3UnlockCard from "@/components/dashboard/Volume3UnlockCard";
import PageStickersGrid from "@/components/dashboard/PageStickersGrid";
import { BOOK2_GATE_CONFIG } from "@/lib/gamification";

export default function Book2DashboardPage() {
  const [scoutName, setScoutName] = useState("Scout Explorer");
  const [quizScore, setQuizScore] = useState(0);
  const [referralScore, setReferralScore] = useState(0);
  const [completedPages, setCompletedPages] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const referralCode = "CAPTAIN-RAY-700";

  // Load persistent state on mount
  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch(`/api/scout/state?token=${referralCode}`);
        const data = await res.json();
        if (data?.scout) {
          setScoutName(data.scout.scoutName || "Scout Explorer");
          setQuizScore(data.scout.quizScore || 0);
          setReferralScore(data.scout.referralScore || 0);
          setCompletedPages(data.scout.completedPages || []);
        }
      } catch (e) {
        // Fallback to local storage if API unreachable
        const savedPages = localStorage.getItem("book2_completed_pages");
        if (savedPages) setCompletedPages(JSON.parse(savedPages));
      }
    }
    loadState();
  }, [referralCode]);

  // Sync state to persistent API
  const persistUpdate = async (updates: Record<string, any>) => {
    setIsSaving(true);
    try {
      await fetch("/api/scout/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: referralCode,
          ...updates,
        }),
      });
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePage = (pageNumber: number) => {
    const updated = completedPages.includes(pageNumber)
      ? completedPages.filter((p) => p !== pageNumber)
      : [...completedPages, pageNumber].sort((a, b) => a - b);

    setCompletedPages(updated);
    localStorage.setItem("book2_completed_pages", JSON.stringify(updated));
    persistUpdate({ completedPages: updated });
  };

  const handleQuizScoreChange = (score: number) => {
    setQuizScore(score);
    persistUpdate({ quizScore: score });
  };

  const handleSimulateReferral = () => {
    setReferralScore(300);
    persistUpdate({ referralScore: 300 });
  };

  const handleResetReferral = () => {
    setReferralScore(0);
    persistUpdate({ referralScore: 0 });
  };

  const totalScore = quizScore + referralScore;
  const hasPassedQuiz = quizScore >= BOOK2_GATE_CONFIG.academicPassThreshold;
  const hasFriendRecruited = referralScore >= BOOK2_GATE_CONFIG.friendReferralPoints;
  const isUnlocked = totalScore >= BOOK2_GATE_CONFIG.unlockThreshold;

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
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
        {/* Welcome Profile Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-paper-deep p-4 sm:p-6 border border-ink/10">
          <div>
            <span className="eyebrow">Scout Profile</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl">🧭</span>
              <input
                type="text"
                value={scoutName}
                onChange={(e) => {
                  setScoutName(e.target.value);
                  persistUpdate({ scoutName: e.target.value });
                }}
                className="font-display text-xl sm:text-2xl font-bold bg-transparent border-b border-dashed border-ink/30 focus:outline-none focus:border-spruce text-ink"
                title="Click to customize scout name"
              />
            </div>
          </div>
          <div className="text-xs text-ink-soft sm:text-right">
            <span>Verified Reader · Persistent Server State</span>
            <span className="block font-mono font-bold text-spruce">
              {isSaving ? "💾 Syncing..." : `Passkey ID: ${referralCode}`}
            </span>
          </div>
        </div>

        {/* 1. Score Gate (Header Banner, 0->400->700 Progress, Digital Ribbon Print) */}
        <ScoreGate
          totalScore={totalScore}
          quizScore={quizScore}
          referralScore={referralScore}
          scoutName={scoutName}
        />

        {/* 2. Ray's 19-Page Illustration Quest & Instant Virtue Stickers Download */}
        <PageStickersGrid
          completedPages={completedPages}
          onTogglePage={handleTogglePage}
        />

        {/* 3. Step 1: Academic Pass - 12-Question Trilogy Mastery Quiz Engine (400 pts) */}
        <ComprehensionQuiz
          currentQuizScore={quizScore}
          onScoreUpdate={handleQuizScoreChange}
          bookNumber={2}
        />

        {/* 4. Step 2: Quest Captain Mission - Friend Referral Engine (300 pts) */}
        <QuestCaptainBox
          hasFriendRecruited={hasFriendRecruited}
          referralCode={referralCode}
          hasPassedQuiz={hasPassedQuiz}
          onSimulateReferral={handleSimulateReferral}
          onResetReferral={handleResetReferral}
        />

        {/* 5. Volume 3 Unlock Celebration & Lulu Automated $0.00 Dispatch */}
        {isUnlocked && <Volume3UnlockCard scoutName={scoutName} />}
      </main>
    </div>
  );
}
