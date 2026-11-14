"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/retail/SiteHeader";
import { SiteFooter } from "@/components/retail/SiteFooter";
import { Spinner } from "@/components/ui/Spinner";
import { useJustBecameTrue } from "@/components/ui/useJustBecameTrue";
import { patrolTokenFrom } from "@/lib/patrol-link";

interface GiftSlot {
  code: string;
  slotNumber: number;
  redeemedAt?: string;
}

interface PatrolState {
  leader: {
    email: string;
    token: string;
    giftsRedeemedCount: number;
    status: "in_progress" | "completed" | "claimed";
  };
  gifts: GiftSlot[];
  approval?: {
    status: "pending" | "approved" | "rejected";
    recipientName: string;
  };
}

function PatrolHubContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  // What is in the access box; it becomes `token` only when the form is sent.
  const [tokenInput, setTokenInput] = useState(tokenFromUrl);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [data, setData] = useState<PatrolState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSlot, setCopiedSlot] = useState<number | null>(null);

  // Claim Form State
  const [recipientName, setRecipientName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zip, setZip] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://puenpublishing.com";

  // Looks the Patrol up once per open or per press of the button, never per
  // keystroke: typing a token by hand used to spend the per-minute lookup limit.
  useEffect(() => {
    // A token saved on this device becomes the token first; the effect then runs again and looks it up once.
    const stored = token ? "" : localStorage.getItem("gg_patrol_token") || "";
    if (stored) {
      setToken(stored);
      return;
    }
    const activeToken = token;
    if (activeToken) {
      fetch(`/api/patrol/state?token=${encodeURIComponent(activeToken)}`)
        .then(async (r) => {
          if (r.status === 404) {
            // A saved token that no longer opens anything must not greet the leader with an error on every visit.
            if (localStorage.getItem("gg_patrol_token") === activeToken) localStorage.removeItem("gg_patrol_token");
            setLookupError("We could not find a Patrol with that token. Please check the link in your receipt email.");
          }
          else if (r.status === 429) setLookupError("Too many tries just now. Please wait a minute and try again.");
          else if (!r.ok) setLookupError("We could not open your Patrol right now. Please try again.");
          const res = r.ok ? await r.json() : null;
          if (res?.success) {
            setData(res);
            localStorage.setItem("gg_patrol_token", activeToken);
          }
        })
        .catch(() => setLookupError("We could not reach the site. Please check your connection and try again."))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, lookupAttempt]);

  const handleCopyLink = (code: string, slot: number) => {
    const link = `${siteUrl}/start?gift=${encodeURIComponent(code)}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedSlot(slot);
      setTimeout(() => setCopiedSlot(null), 3000);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClaim(true);
    setClaimError(null);
    setClaimMessage(null);

    try {
      const res = await fetch("/api/patrol/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patrolToken: token,
          recipientName,
          street,
          city,
          state: stateVal,
          zip,
        }),
      });
      const resData = await res.json();
      if (res.ok && resData?.success) {
        setClaimMessage(resData.message || "Claim submitted!");
        // Refresh state
        fetch(`/api/patrol/state?token=${encodeURIComponent(token)}`)
          .then((r) => r.json())
          .then((d) => d?.success && setData(d));
      } else {
        setClaimError(resData?.error || "Could not submit claim.");
      }
    } catch {
      setClaimError("Network error. Please try again.");
    }
    setSubmittingClaim(false);
  };

  // The claim panel appearing because the leader just submitted is celebrated;
  // one already there when the page opened is not. The page does not poll, so a
  // later approval is seen on the next visit, quietly.
  const approvalJustArrived = useJustBecameTrue(Boolean(data?.approval), !loading);

  if (loading) {
    return (
      <main className="min-h-screen bg-paper px-4 py-16 text-center text-ink">
        <p className="inline-flex items-center gap-2 text-lg font-bold" role="status">
          <Spinner className="h-5 w-5 text-spruce" /> Loading Patrol Leader Hub…
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-paper px-4 py-16 text-center text-ink">
        <div className="mx-auto max-w-md rounded-3xl border-2 border-clay/30 bg-paper-deep p-8 shadow-card">
          <h2 className="text-2xl font-bold font-display text-ink">Patrol Access</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Enter your Patrol Leader token or check the link sent with your $10 Patrol bundle receipt.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // The box keeps whatever was typed or pasted; the token is taken out only now.
              const next = patrolTokenFrom(tokenInput);
              if (!next) {
                setLookupError("Please paste your Patrol link or token.");
                return;
              }
              setLookupError(null);
              setLoading(true);
              setToken(next);
              setLookupAttempt((n) => n + 1);
            }}
            className="mt-6 space-y-4"
          >
            <input
              type="text"
              placeholder="Paste your Patrol link or token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              aria-label="Patrol Leader token or link"
              autoComplete="off"
              spellCheck={false}
              className="input text-center font-mono text-sm"
              required
            />
            {lookupError && (
              <p role="alert" className="text-sm font-semibold text-clay-dark">
                {lookupError}
              </p>
            )}
            <button type="submit" className="btn-primary w-full text-sm">
              Open My Patrol Hub
            </button>
          </form>
        </div>
      </main>
    );
  }

  const redeemedCount = data.leader.giftsRedeemedCount;
  const isGoalReached = redeemedCount >= 3;
  const isClaimed = data.leader.status === "claimed";
  const approval = data.approval;

  return (
    <main className="min-h-screen bg-paper px-4 py-12 sm:py-16 text-ink">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Hub Header */}
        <div className="rounded-3xl border-3 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 via-paper to-spruce/10 p-6 sm:p-10 shadow-book text-center">
          <span className="eyebrow">Chief Scout Patrol Leader Hub</span>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black font-display text-ink">
            Patrol Mission: Gift 3 Books
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-ink-soft">
            Patrol Leader: <strong className="text-ink">{data.leader.email}</strong>
          </p>

          {/* Progress Bar */}
          <div className="mt-8 mx-auto max-w-xl">
            <div className="flex justify-between items-center text-sm font-bold text-ink mb-2">
              <span>Gift Memberships Registered</span>
              <span className="text-spruce-dark font-black">{redeemedCount} / 3 Families</span>
            </div>
            <div className="h-5 w-full overflow-hidden rounded-full bg-ink/10 p-1">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-crayon-gold to-spruce"
                style={{ width: `${Math.round((redeemedCount / 3) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {isGoalReached
                ? "🎉 Milestone Complete! All 3 families have registered their Chief Explorers."
                : `Gift your links below. ${3 - redeemedCount} more ${3 - redeemedCount === 1 ? "family" : "families"} needed to earn your Free Printed Parent's Guide!`}
            </p>
          </div>
        </div>

        {/* 3 Gift Codes Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.gifts.map((gift) => {
            const isRedeemed = Boolean(gift.redeemedAt);
            const giftUrl = `${siteUrl}/start?gift=${encodeURIComponent(gift.code)}`;

            return (
              <div
                key={gift.code}
                className={`rounded-2xl border-2 p-5 shadow-card flex flex-col justify-between ${
                  isRedeemed ? "border-spruce/40 bg-spruce/10" : "border-ink/10 bg-paper-deep"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-ink-soft">
                      Gift Slot #{gift.slotNumber}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isRedeemed ? "bg-spruce text-paper" : "bg-crayon-gold/40 text-ink"
                      }`}
                    >
                      {isRedeemed ? "✓ Registered" : "Available"}
                    </span>
                  </div>

                  <div className="mt-4 text-center">
                    <code className="text-sm font-black font-mono text-ink bg-paper px-2.5 py-1 rounded border border-ink/10 block">
                      {gift.code}
                    </code>
                    <p className="mt-2 text-xs text-ink-soft">
                      {isRedeemed
                        ? "Explorer account activated and enrolled in Fleet!"
                        : "Share this link with a family to gift Book 1 registration."}
                    </p>
                  </div>
                </div>

                {!isRedeemed && (
                  <button
                    type="button"
                    onClick={() => handleCopyLink(gift.code, gift.slotNumber)}
                    className="btn-primary w-full mt-5 min-h-11 text-xs py-2"
                  >
                    {copiedSlot === gift.slotNumber ? <span className="inline-block animate-pop-in">✓ Copied Gift Link!</span> : "Copy Gift Link"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Reward Gate / Claim Section */}
        {isGoalReached && (
          <div className="rounded-3xl border-2 border-spruce/40 bg-spruce/10 p-6 sm:p-10 shadow-book">
            <div className="text-center">
              <span className="inline-block rounded-full bg-spruce px-4 py-1 text-xs font-black uppercase tracking-wider text-paper mb-2">
                🏆 Patrol Leader Reward Unlocked
              </span>
              <h2 className="text-2xl sm:text-3xl font-black font-display text-ink">
                Claim Your Free Printed Parent&apos;s Guide
              </h2>
              <p className="mt-2 text-sm text-ink-soft max-w-xl mx-auto">
                Thank you for growing the Geezy Goober fleet! Provide your shipping address below. Ray Puen&apos;s team will approve and dispatch your printed copy via IngramSpark.
              </p>
            </div>

            {approval ? (
              <div
                className={`mt-8 rounded-2xl border-2 border-spruce/30 bg-paper p-6 text-center max-w-lg mx-auto shadow-card ${
                  approvalJustArrived ? "animate-rise" : ""
                }`}
              >
                <span className={`inline-block text-3xl ${approvalJustArrived ? "animate-boing" : ""}`} aria-hidden="true">
                  📦
                </span>
                <h4 className="mt-2 text-lg font-bold text-ink">
                  {approval.status === "approved"
                    ? "✅ Reward Approved for Printing!"
                    : approval.status === "rejected"
                    ? "Review Status: Declined"
                    : "⏳ Submitted — Awaiting Ray's One-Click Approval"}
                </h4>
                <p className="mt-2 text-xs text-ink-soft">
                  Recipient: <strong>{approval.recipientName}</strong>
                </p>
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit} className="mt-8 space-y-4 max-w-lg mx-auto bg-paper p-6 sm:p-8 rounded-2xl border border-ink/10 shadow-card">
                {claimError && (
                  <p role="alert" className="rounded-lg bg-clay/10 border border-clay/30 p-3 text-xs font-bold text-clay-dark">
                    {claimError}
                  </p>
                )}
                {claimMessage && (
                  <p role="status" className="rounded-lg bg-spruce/10 border border-spruce/30 p-3 text-xs font-bold text-spruce-dark">
                    {claimMessage}
                  </p>
                )}

                <div>
                  <label htmlFor="claim-name" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    id="claim-name"
                    autoComplete="shipping name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    required
                    className="input text-sm"
                    placeholder="e.g. Sarah Jenkins"
                  />
                </div>

                <fieldset className="space-y-4">
                  <legend className="mb-2 text-sm font-bold text-ink">Where should we ship it?</legend>
                <div>
                  <label htmlFor="claim-street" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    id="claim-street"
                    autoComplete="shipping address-line1"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                    className="input text-sm"
                    placeholder="e.g. 123 Pinecrest Way"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label htmlFor="claim-city" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">City *</label>
                    <input
                      type="text"
                      id="claim-city"
                      autoComplete="shipping address-level2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="input text-sm"
                      placeholder="e.g. Yucaipa"
                    />
                  </div>
                  <div className="col-span-1">
                    <label htmlFor="claim-state" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">State *</label>
                    <input
                      type="text"
                      id="claim-state"
                      autoComplete="shipping address-level1"
                      autoCapitalize="characters"
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value.toUpperCase())}
                      required
                      className="input text-sm"
                      placeholder="CA"
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-1">
                    <label htmlFor="claim-zip" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">ZIP *</label>
                    <input
                      type="text"
                      id="claim-zip"
                      autoComplete="shipping postal-code"
                      inputMode="numeric"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      required
                      className="input text-sm"
                      placeholder="92399"
                    />
                  </div>
                </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="btn-primary w-full mt-4 text-sm py-3 font-bold"
                >
                  {submittingClaim ? <><Spinner className="h-4 w-4" /> Submitting Shipping Claim…</> : "Submit Claim for Free Printed Guide"}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="text-center">
          <Link href="/guide" className="inline-flex min-h-11 items-center text-xs font-semibold text-spruce hover:underline">
            ← Back to Parent&apos;s Guide Info
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PatrolDashboardPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="min-h-screen bg-paper px-4 py-16 text-center text-ink"><p>Loading…</p></main>}>
        <PatrolHubContent />
      </Suspense>
      <SiteFooter />
    </>
  );
}
