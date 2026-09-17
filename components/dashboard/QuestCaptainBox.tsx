"use client";

import React, { useState } from "react";
import {
  REFERRAL_FRIEND_REQUIREMENT,
  REFERRAL_INVITE_CAPACITY,
} from "@/lib/gamification";

interface QuestCaptainBoxProps {
  /** How many of the invited friends (0–3) have coloured their Page 1. */
  friendsCompleted: number;
  /** Demo control: set the completed-friend count directly. */
  onSetFriends: (count: number) => void;
  referralCode: string;
  hasPassedQuiz: boolean;
}

export default function QuestCaptainBox({
  friendsCompleted,
  onSetFriends,
  referralCode,
  hasPassedQuiz,
}: QuestCaptainBoxProps) {
  const [copied, setCopied] = useState(false);
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://raypuenpublishing.vercel.app";
  const referralLink = `${siteUrl}/?ref=${referralCode}`;

  const required = REFERRAL_FRIEND_REQUIREMENT;
  const capacity = REFERRAL_INVITE_CAPACITY;
  const gateMet = friendsCompleted >= required;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className={`rounded-2xl border p-6 sm:p-8 shadow-card transition ${
      gateMet
        ? "border-spruce/40 bg-spruce/5"
        : hasPassedQuiz
        ? "border-crayon-gold bg-crayon-goldsoft/20 ring-2 ring-crayon-gold/30"
        : "border-ink/10 bg-paper opacity-80"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5">
        <div>
          <span className="eyebrow">Step 2: The Quest Captain Mission (300 Points)</span>
          <h3 className="mt-1 text-2xl font-bold font-display text-ink">
            Recruit {required} Friends to Join the Circle
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Share your Captain Link with {capacity} friends. The moment any{" "}
            <strong>{required} of them</strong> log in and turn their Page 1 sticker
            from grayscale to full colour, you earn 300 points and complete the Biblical 700!
          </p>
        </div>
        <div className="rounded-xl bg-paper-deep px-4 py-2 text-right border border-ink/10">
          <span className="text-xs font-bold text-ink-soft uppercase tracking-wider block">Captain Points</span>
          <span className="text-2xl font-black font-display text-spruce">
            {gateMet ? "300 / 300 pts" : "0 / 300 pts"}
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

        {/* Live friend-completion tracker: 3 invite slots, 2 required */}
        <div className="mt-6 rounded-xl border border-ink/10 bg-paper-deep p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-soft block">
                Live Referral Verification
              </span>
              <span className={`text-sm font-bold ${gateMet ? "text-spruce" : "text-ink"}`}>
                {gateMet
                  ? `✅ ${friendsCompleted} Friends Verified! (2-of-3 gate met · 300 Points Awarded)`
                  : `⏳ ${friendsCompleted} of ${required} required friends have coloured Page 1...`}
              </span>
            </div>
          </div>

          {/* Friend invite slots */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {Array.from({ length: capacity }).map((_, i) => {
              const done = i < friendsCompleted;
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 text-center transition ${
                    done
                      ? "border-spruce/50 bg-spruce/10"
                      : "border-ink/15 bg-paper opacity-70"
                  }`}
                >
                  <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                    done ? "bg-spruce text-paper" : "bg-ink/10 text-ink-soft grayscale"
                  }`}>
                    {done ? "🎨" : "👤"}
                  </div>
                  <p className="mt-1.5 text-[11px] font-bold text-ink">Friend {i + 1}</p>
                  <p className={`text-[10px] font-semibold ${done ? "text-spruce" : "text-ink-soft"}`}>
                    {done ? "Page 1 in colour" : "Invited"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Demo controls (Simulate friend joins / reset) */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSetFriends(Math.min(capacity, friendsCompleted + 1))}
              disabled={friendsCompleted >= capacity}
              className="rounded-lg bg-clay px-3.5 py-2 text-xs font-bold text-paper transition hover:bg-clay-dark shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title="Simulate one invited friend logging in and colouring their Page 1"
            >
              ⚡ Simulate Friend Join (+1)
            </button>
            {friendsCompleted > 0 && (
              <button
                type="button"
                onClick={() => onSetFriends(0)}
                className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper"
              >
                Reset Referral Test
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
