"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ScoreGate from "@/components/dashboard/ScoreGate";
import ComprehensionQuiz from "@/components/dashboard/ComprehensionQuiz";
import QuestCaptainBox from "@/components/dashboard/QuestCaptainBox";
import BookUnlockCard from "@/components/dashboard/BookUnlockCard";
import GrandpaSponsorCard from "@/components/dashboard/GrandpaSponsorCard";
import Book2ContinuationBanner from "@/components/dashboard/Book2ContinuationBanner";
import PageStickersGrid from "@/components/dashboard/PageStickersGrid";
import { BOOK2_GATE_CONFIG } from "@/lib/gamification";

export default function Book2DashboardPage() {
  const [scoutName, setScoutName] = useState("Scout Explorer");
  const [quizScore, setQuizScore] = useState(0);
  const [referralScore, setReferralScore] = useState(0);
  const [friendsCompleted, setFriendsCompleted] = useState(0);
  const [book3Unlocked, setBook3Unlocked] = useState(false);
  const [completedPages, setCompletedPages] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const referralCode = "CAPTAIN-RAY-700";

  // Load persistent state on mount
  useEffect(() => {
    async function confirmSponsorshipIfReturning() {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("sponsored") === "1" && params.get("session_id")) {
        try {
          await fetch("/api/checkout/sponsor/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: params.get("session_id") }),
          });
        } catch {
          // ignore — the Stripe webhook is the primary unlock path
        } finally {
          // Clean the query string so a refresh doesn't re-confirm.
          window.history.replaceState({}, "", "/dashboard/book2");
        }
      }
    }

    async function loadState() {
      try {
        const res = await fetch(`/api/scout/state?token=${referralCode}`);
        const data = await res.json();
        if (data?.scout) {
          setScoutName(data.scout.scoutName || "Scout Explorer");
          setQuizScore(data.scout.quizScore || 0);
          setReferralScore(data.scout.referralScore || 0);
          setFriendsCompleted(data.scout.friendsCompleted || 0);
          setBook3Unlocked(Boolean(data.scout.book3Unlocked));
          setCompletedPages(data.scout.completedPages || []);
        }
      } catch (e) {
        // Fallback to local storage if API unreachable
        const savedPages = localStorage.getItem("book2_completed_pages");
        if (savedPages) setCompletedPages(JSON.parse(savedPages));
      }
    }
    // Confirm any returning Grandpa sponsorship first, then load the fresh state.
    confirmSponsorshipIfReturning().then(loadState);
  }, [referralCode]);

  // Sync state to persistent API. The server is authoritative: it returns the
  // canonical scout record, which we mirror back into local state.
  const persistUpdate = async (updates: Record<string, any>) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/scout/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: referralCode,
          ...updates,
        }),
      });
      const data = await res.json();
      if (data?.scout) {
        setQuizScore(data.scout.quizScore ?? 0);
        setReferralScore(data.scout.referralScore ?? 0);
        setFriendsCompleted(data.scout.friendsCompleted ?? 0);
        setBook3Unlocked(Boolean(data.scout.book3Unlocked));
        setCompletedPages(data.scout.completedPages ?? []);
      }
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

  // Quiz answers are graded server-side; we never send a client-computed score.
  const handleQuizSubmit = (answers: Record<string, number>, book: 1 | 2 | 3) => {
    persistUpdate({ quizAnswers: answers, quizBook: book });
  };

  const handleQuizReset = (book: 1 | 2 | 3) => {
    persistUpdate({ quizAnswers: {}, quizBook: book });
  };

  const handleSetFriends = (count: number) => {
    persistUpdate({ demoFriendsCompleted: count });
  };

  const totalScore = quizScore + referralScore;
  const hasPassedQuiz = quizScore >= BOOK2_GATE_CONFIG.academicPassThreshold;
  const isBook2Unlocked = totalScore >= BOOK2_GATE_CONFIG.unlockThreshold;

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
        {/* Rule 2: Book 2 Continuation Hook — persistent nudge toward the Grandpa path,
            shown once Book 2 is unlocked but no relative has sponsored yet. */}
        {isBook2Unlocked && !book3Unlocked && <Book2ContinuationBanner />}

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

        {/* 3. Step 1: Academic Pass - Book 1 Comprehension Quiz Engine (400 pts) */}
        <ComprehensionQuiz
          currentQuizScore={quizScore}
          onSubmitAnswers={handleQuizSubmit}
          onReset={handleQuizReset}
          bookNumber={1}
        />

        {/* 4. Step 2: Quest Captain Mission - 2-of-3 Friend Referral Engine (300 pts) */}
        <QuestCaptainBox
          friendsCompleted={friendsCompleted}
          referralCode={referralCode}
          hasPassedQuiz={hasPassedQuiz}
          onSetFriends={handleSetFriends}
        />

        {/* 5. Peer track: reaching 700 pts unlocks Book 2 free (IngramSpark dispatch) */}
        {isBook2Unlocked && <BookUnlockCard scoutName={scoutName} bookNumber={2} />}

        {/* 6. Grandpa track: a relative's $40 sponsorship unlocks Book 3 in parallel */}
        {book3Unlocked ? (
          <BookUnlockCard scoutName={scoutName} bookNumber={3} />
        ) : (
          <GrandpaSponsorCard scoutToken={referralCode} scoutName={scoutName} />
        )}
      </main>
    </div>
  );
}
