"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { GRANDPA_SPONSOR_PRICE } from "@/lib/gamification";
import { publisherBrand } from "@/lib/book";

/**
 * Public landing page a relative reaches by scanning the Grandpa QR code (or
 * opening the shared link). It reads the scout token from the query string and
 * starts the $40 sponsorship checkout, which unlocks Book 3 for that Scout.
 */
export default function SponsorLandingPage() {
  const [token, setToken] = useState<string>("");
  const [scoutName, setScoutName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setToken((params.get("token") || "").trim());
    setScoutName((params.get("scout") || "").replace(/[<>]/g, "").slice(0, 60));
  }, []);

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(GRANDPA_SPONSOR_PRICE);

  const handleSponsor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoutToken: token, scoutName }),
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

  const tokenValid = /^[A-Za-z0-9_-]{3,64}$/.test(token);

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-2xl border-2 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 to-paper p-8 text-center shadow-book">
        <div className="text-5xl mb-3">💛</div>
        <p className="eyebrow mb-2">The Grandpa Multiplier</p>
        <h1 className="font-display text-3xl font-black text-ink sm:text-4xl">
          Sponsor Book 3 {scoutName ? `for ${scoutName}` : "for a young Scout"}
        </h1>
        <p className="mt-4 text-base text-ink-soft leading-relaxed">
          A single <strong>{price}</strong> gift instantly pre-approves and unlocks
          Book 3 free for this Scout — a wonderful way for a grandparent, relative,
          or family friend to cheer them on.
        </p>

        {tokenValid ? (
          <button
            type="button"
            onClick={handleSponsor}
            disabled={loading}
            className="btn-primary mt-6 w-full text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Redirecting to secure checkout…" : `💳 Sponsor Book 3 (${price})`}
          </button>
        ) : (
          <p className="mt-6 rounded-lg bg-clay/10 border border-clay/30 p-4 text-sm font-semibold text-clay-dark">
            This sponsorship link is missing its Scout code. Please use the exact QR
            code or link from the Scout&apos;s dashboard.
          </p>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-clay-dark">⚠️ {error}</p>}

        <p className="mt-4 text-xs text-ink-soft">
          Secure payment via Stripe. Book 3 unlocks automatically once the sponsorship is confirmed.
        </p>

        <p className="mt-6 border-t border-ink/10 pt-4 text-xs text-ink-soft/80">
          {publisherBrand.fullCredit}
        </p>

        <Link href="/" className="mt-4 inline-block text-xs font-semibold text-spruce hover:underline">
          ← Back to Storefront
        </Link>
      </div>
    </main>
  );
}
