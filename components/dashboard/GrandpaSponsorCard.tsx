"use client";

import React, { useState } from "react";
import { GRANDPA_SPONSOR_PRICE } from "@/lib/gamification";
import SponsorQRCode from "@/components/dashboard/SponsorQRCode";

interface GrandpaSponsorCardProps {
  scoutToken: string;
  scoutName: string;
}

/**
 * Ray's directive #6 — the "Grandpa multiplier". An adult relative or family
 * friend can sponsor a flat $40, which leap-frogs the peer track and unlocks
 * Book 3 free, independently of the 700-point Book 2 path.
 */
export default function GrandpaSponsorCard({ scoutToken, scoutName }: GrandpaSponsorCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSponsor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoutToken, scoutName }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError(data?.error || "Unable to start the sponsorship checkout.");
        setLoading(false);
      }
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(GRANDPA_SPONSOR_PRICE);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://raypuenpublishing.vercel.app";
  const sponsorLink = `${origin}/sponsor?token=${encodeURIComponent(scoutToken)}${
    scoutName ? `&scout=${encodeURIComponent(scoutName)}` : ""
  }`;

  return (
    <div className="rounded-2xl border-2 border-clay/30 bg-gradient-to-b from-clay/5 to-paper p-6 sm:p-8 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">💛</span>
          <div>
            <span className="eyebrow">Advanced Relative Track</span>
            <h3 className="mt-1 text-2xl font-bold font-display text-ink">
              The Grandpa Multiplier — Sponsor Book 3
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              Are you a grandparent, relative, or family friend? A single{" "}
              <strong>{price} contribution</strong> leap-frogs the peer track and
              unlocks <strong>Book 3 completely free</strong> for {scoutName || "this Scout"} —
              on top of the Book 2 they&apos;ll earn through their own quest.
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-paper-deep px-4 py-2 text-right border border-ink/10">
          <span className="text-xs font-bold text-ink-soft uppercase tracking-wider block">Flat Contribution</span>
          <span className="text-2xl font-black font-display text-clay">{price}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-1">
          <button
            type="button"
            onClick={handleSponsor}
            disabled={loading}
            className="btn-primary w-full sm:w-auto text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Redirecting to secure checkout…" : `💳 Sponsor Book 3 (${price})`}
          </button>
          <p className="mt-2 text-xs text-ink-soft">
            Secure payment via Stripe. Book 3 unlocks automatically the moment the sponsorship is confirmed.
          </p>
        </div>

        {/* Legacy QR checkout — a relative can scan to sponsor from a printed page or shared screen */}
        <SponsorQRCode value={sponsorLink} caption="Scan to sponsor Book 3 — hand this to a relative!" />
      </div>

      {error && (
        <p className="mt-3 text-sm font-semibold text-clay-dark">⚠️ {error}</p>
      )}
    </div>
  );
}
