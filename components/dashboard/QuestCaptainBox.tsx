"use client";

import React, { useState } from "react";

interface QuestCaptainBoxProps {
  hasFriendRecruited: boolean;
  onSimulateReferral: () => void;
  onResetReferral: () => void;
  referralCode: string;
  hasPassedQuiz: boolean;
}

export default function QuestCaptainBox({
  hasFriendRecruited,
  onSimulateReferral,
  onResetReferral,
  referralCode,
  hasPassedQuiz,
}: QuestCaptainBoxProps) {
  const [copied, setCopied] = useState(false);
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://raypuenpublishing.vercel.app";
  const referralLink = `${siteUrl}/?ref=${referralCode}`;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className={`rounded-2xl border p-6 sm:p-8 shadow-card transition ${
      hasFriendRecruited
        ? "border-spruce/40 bg-spruce/5"
        : hasPassedQuiz
        ? "border-crayon-gold bg-crayon-goldsoft/20 ring-2 ring-crayon-gold/30"
        : "border-ink/10 bg-paper opacity-80"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5">
        <div>
          <span className="eyebrow">Step 2: The Quest Captain Mission (300 Points)</span>
          <h3 className="mt-1 text-2xl font-bold font-display text-ink">
            Recruit 1 Friend to Join the Circle
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Bring exactly 1 friend to start their coloring quest. Once they join, you earn 300 points and complete the Biblical 700!
          </p>
        </div>
        <div className="rounded-xl bg-paper-deep px-4 py-2 text-right border border-ink/10">
          <span className="text-xs font-bold text-ink-soft uppercase tracking-wider block">Captain Points</span>
          <span className="text-2xl font-black font-display text-spruce">
            {hasFriendRecruited ? "300 / 300 pts" : "0 / 300 pts"}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-2">
          Your Official Quest Captain Link
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="input font-mono text-sm bg-paper-deep text-ink select-all flex-1 cursor-pointer"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="btn-primary sm:w-auto text-sm py-2.5 px-6 whitespace-nowrap"
          >
            {copied ? "✓ Copied Link!" : "Copy Captain Link"}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Share this link with family, friends, Sunday school classes, or homeschool circles.
        </p>

        <div className="mt-6 rounded-xl border border-ink/10 bg-paper-deep p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-soft block">
                Live Referral Verification
              </span>
              <span className={`text-sm font-bold ${hasFriendRecruited ? "text-spruce" : "text-ink"}`}>
                {hasFriendRecruited
                  ? "✅ 1 Friend Recruited! (Friend Order Verified · 300 Points Awarded)"
                  : "⏳ Awaiting friend referral confirmation..."}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!hasFriendRecruited ? (
                <button
                  type="button"
                  onClick={onSimulateReferral}
                  className="rounded-lg bg-clay px-3.5 py-2 text-xs font-bold text-paper transition hover:bg-clay-dark shadow-sm"
                  title="Test how the system rewards 300 points when a friend completes an order"
                >
                  ⚡ Simulate Friend Join (+300 pts)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResetReferral}
                  className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper"
                >
                  Reset Referral Test
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
