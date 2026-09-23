"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScoreGate from "@/components/dashboard/ScoreGate";
import ComprehensionQuiz from "@/components/dashboard/ComprehensionQuiz";
import QuestCaptainBox from "@/components/dashboard/QuestCaptainBox";
import BookUnlockCard from "@/components/dashboard/BookUnlockCard";
import GrandpaSponsorCard from "@/components/dashboard/GrandpaSponsorCard";
import Book2ContinuationBanner from "@/components/dashboard/Book2ContinuationBanner";
import PageStickersGrid from "@/components/dashboard/PageStickersGrid";
import { BOOK2_GATE_CONFIG } from "@/lib/gamification";

const DEMO_TOKEN = "CAPTAIN-RAY-700";

export default function Book2DashboardPage() {
  const router = useRouter();
  // "family": the child of the family signed in on this device.
  // "demo":   the shared preview profile (/dashboard/book2?demo=1).
  // "error" matters as much as the rest: an empty dashboard means "no progress
  // yet", so it may only ever be shown when the server actually said so.
  const [mode, setMode] = useState<"loading" | "family" | "demo" | "error">("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [scoutName, setScoutName] = useState("");
  const [quizScore, setQuizScore] = useState(0);
  const [referralScore, setReferralScore] = useState(0);
  const [friendsCompleted, setFriendsCompleted] = useState(0);
  const [book3Unlocked, setBook3Unlocked] = useState(false);
  const [completedPages, setCompletedPages] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const applyScout = (scout: any) => {
    setScoutName(scout.scoutName || "");
    setQuizScore(scout.quizScore ?? 0);
    setReferralScore(scout.referralScore ?? 0);
    setFriendsCompleted(scout.friendsCompleted ?? 0);
    setBook3Unlocked(Boolean(scout.book3Unlocked));
    setCompletedPages(scout.completedPages ?? []);
    if (scout.shareCode) setShareCode(scout.shareCode);
  };

  // Load the signed-in family's child, the demo profile, or send the visitor to sign up.
  const loadScout = useCallback(async () => {
    const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";
    setMode("loading");
    try {
      const res = await fetch(isDemo ? `/api/scout/state?token=${DEMO_TOKEN}` : "/api/scout/state", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/start");
        return;
      }
      // Anything else that is not OK (rate limit, server error) must not fall
      // through to the empty defaults — that would show a child with real
      // progress a dashboard reset to zero.
      if (!res.ok) {
        setMode("error");
        return;
      }
      const data = await res.json();
      if (data?.scout) applyScout(data.scout);
      setMode(isDemo ? "demo" : "family");
    } catch {
      setMode("error");
    }
  }, [router]);

  useEffect(() => {
    loadScout();
  }, [loadScout]);

  // Sync state to persistent API. The server is authoritative: it returns the
  // canonical scout record, which we mirror back into local state. A family's
  // requests carry no token; the server uses this device's session.
  /** Returns whether the change was actually confirmed saved by the server. */
  const persistUpdate = async (
    updates: Record<string, any>,
    rollback?: () => void
  ): Promise<boolean> => {
    setIsSaving(true);
    setSaveFailed(false);
    try {
      const res = await fetch("/api/scout/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "demo" ? { token: DEMO_TOKEN, ...updates } : updates),
      });
      const data = await res.json().catch(() => null);

      // The server now tells us whether the write actually reached the database.
      // Anything short of a confirmed save has to undo the optimistic change,
      // otherwise a sticker stays lit that nobody ever recorded.
      if (!res.ok || data?.saved === false) {
        rollback?.();
        setSaveFailed(true);
        return false;
      }

      if (data?.scout) {
        setQuizScore(data.scout.quizScore ?? 0);
        setReferralScore(data.scout.referralScore ?? 0);
        setFriendsCompleted(data.scout.friendsCompleted ?? 0);
        setBook3Unlocked(Boolean(data.scout.book3Unlocked));
        setCompletedPages(data.scout.completedPages ?? []);
      }
      return true;
    } catch {
      rollback?.();
      setSaveFailed(true);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/family/logout", { method: "POST" });
    router.replace("/start");
  };

  const handleTogglePage = (pageNumber: number) => {
    const previous = completedPages;
    const updated = completedPages.includes(pageNumber)
      ? completedPages.filter((p) => p !== pageNumber)
      : [...completedPages, pageNumber].sort((a, b) => a - b);

    setCompletedPages(updated);
    persistUpdate({ completedPages: updated }, () => setCompletedPages(previous));
  };

  // Quiz answers are graded server-side; we never send a client-computed score.
  // The result is handed back so the quiz can unlock itself again if the 400
  // points were never actually recorded.
  const handleQuizSubmit = (answers: Record<string, number>, book: 1 | 2 | 3) =>
    persistUpdate({ quizAnswers: answers, quizBook: book });

  const handleQuizReset = (book: 1 | 2 | 3) => {
    persistUpdate({ quizAnswers: {}, quizBook: book });
  };

  const handleSetFriends = (count: number) => {
    persistUpdate({ demoFriendsCompleted: count });
  };

  const totalScore = quizScore + referralScore;
  const hasPassedQuiz = quizScore >= BOOK2_GATE_CONFIG.academicPassThreshold;
  const isBook2Unlocked = totalScore >= BOOK2_GATE_CONFIG.unlockThreshold;

  if (mode === "loading") {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center">
        <p className="text-ink-soft font-semibold">Opening your Explorer dashboard…</p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-ink/10 bg-paper p-8 text-center shadow-card">
          <h1 className="font-display text-2xl font-bold">We couldn&apos;t load your progress</h1>
          <p className="mt-3 text-ink-soft leading-relaxed">
            Your stickers and points are safe — we just couldn&apos;t reach them right
            now. Please try again in a moment.
          </p>
          <button onClick={loadScout} className="btn-primary mt-6 w-full">
            Try again
          </button>
        </div>
      </div>
    );
  }

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
        {/* A save that did not reach the database is never hidden: the sticker has
            already been rolled back, so the child is told rather than left with a
            dashboard that disagrees with what was actually recorded. */}
        {saveFailed && (
          <div
            role="alert"
            className="rounded-2xl border border-clay/30 bg-clay/10 p-4 text-sm text-ink flex flex-wrap items-center justify-between gap-3"
          >
            <span>
              <strong className="font-bold">That didn&apos;t save.</strong> Your last
              change wasn&apos;t recorded, so we&apos;ve put it back. Please try again.
            </span>
            <button onClick={() => setSaveFailed(false)} className="text-xs font-bold underline">
              Dismiss
            </button>
          </div>
        )}

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
              {isSaving ? "💾 Syncing..." : mode === "demo" ? "Demo profile" : `Explorer code: ${shareCode}`}
            </span>
            {mode === "family" && (
              <button type="button" onClick={handleSignOut} className="mt-1 text-xs font-semibold text-ink-soft underline hover:text-ink">
                Not your family? Sign out
              </button>
            )}
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
          referralCode={mode === "demo" ? DEMO_TOKEN : shareCode}
          hasPassedQuiz={hasPassedQuiz}
          showDemoControls={mode === "demo"}
          onSetFriends={handleSetFriends}
        />

        {/* 5. Peer track: reaching 700 pts unlocks Book 2 free (IngramSpark dispatch) */}
        {isBook2Unlocked && <BookUnlockCard scoutName={scoutName} bookNumber={2} />}

        {/* 6. Grandpa track: a relative's $40 sponsorship unlocks Book 3 in parallel */}
        {book3Unlocked ? (
          <BookUnlockCard scoutName={scoutName} bookNumber={3} />
        ) : (
          <GrandpaSponsorCard
            shareCode={shareCode}
            scoutName={scoutName}
            demoToken={mode === "demo" ? DEMO_TOKEN : undefined}
          />
        )}
      </main>
    </div>
  );
}
