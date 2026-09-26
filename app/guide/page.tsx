"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/retail/SiteHeader";
import { SiteFooter } from "@/components/retail/SiteFooter";
import { PARENTS_GUIDE_DIGITAL_PRICE, PATROL_BUNDLE_PRICE, formatCurrency } from "@/lib/pricing";

export default function ParentsGuidePage() {
  const [loadingType, setLoadingType] = useState<"digital" | "patrol" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (type: "digital" | "patrol") => {
    setLoadingType(type);
    setError(null);
    try {
      const endpoint = type === "digital" ? "/api/checkout/guide" : "/api/checkout/patrol";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error || "Could not start checkout. Please try again.");
    } catch {
      setError("Network error. Please check your connection.");
    }
    setLoadingType(null);
  };

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-paper px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          {/* Header Banner */}
          <div className="text-center">
            <span className="eyebrow">Companion Curriculum &amp; Leadership</span>
            <h1 className="mt-2 text-3xl sm:text-5xl font-black font-display text-ink">
              The Parent&apos;s Guide &amp; Teacher&apos;s Master Manual
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-ink-soft leading-relaxed">
              Equip your home, homeschool co-op, or Sunday school circle with the comprehensive virtue curriculum, discussion prompts, and activity companion for <em>The Geezy Goober</em>.
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl bg-clay/10 border border-clay/30 p-4 text-center text-sm font-bold text-clay-dark">
              {error}
            </div>
          )}

          {/* Pricing Options */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Option 1: Digital Edition ($29.97) */}
            <div className="rounded-3xl border-2 border-ink/10 bg-paper-deep p-6 sm:p-8 shadow-card flex flex-col justify-between">
              <div>
                <span className="inline-block rounded-full bg-spruce/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-spruce-dark mb-3">
                  Digital Edition
                </span>
                <h3 className="text-2xl font-bold font-display text-ink">
                  Instant Master PDF Download
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-black font-display text-ink">
                    {formatCurrency(PARENTS_GUIDE_DIGITAL_PRICE)}
                  </span>
                  <span className="text-sm font-semibold text-ink-soft">one-time</span>
                </div>
                <p className="mt-4 text-sm text-ink-soft leading-relaxed">
                  Complete digital curriculum with printable lesson worksheets, Biblical virtue milestones, and story discussion guides.
                </p>

                <ul className="mt-6 space-y-2.5 text-sm text-ink">
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> Full 34-page companion PDF curriculum
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> Printable virtue worksheets for all 19 badges
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> Instant download link delivered immediately
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> Unlimited home &amp; family printing license
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleCheckout("digital")}
                disabled={loadingType !== null}
                className="btn-primary w-full mt-8 py-3.5 text-base"
              >
                {loadingType === "digital" ? "Connecting to Checkout…" : "Get Digital Guide ($29.97)"}
              </button>
            </div>

            {/* Option 2: Chief Scout Patrol Leader ($10.00 Bundle) */}
            <div className="rounded-3xl border-3 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 via-paper to-spruce/10 p-6 sm:p-8 shadow-book flex flex-col justify-between relative">
              <div className="absolute -top-3.5 right-6">
                <span className="rounded-full bg-crayon-gold px-3 py-1 text-xs font-black uppercase tracking-wider text-ink shadow-sm">
                  ★ Most Popular · Loss Leader
                </span>
              </div>

              <div>
                <span className="inline-block rounded-full bg-spruce/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-spruce-dark mb-3">
                  Patrol Leader Mission
                </span>
                <h3 className="text-2xl font-bold font-display text-ink">
                  Chief Scout Patrol Bundle
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-black font-display text-spruce-dark">
                    {formatCurrency(PATROL_BUNDLE_PRICE)}
                  </span>
                  <span className="text-sm font-semibold text-ink-soft">special bundle</span>
                </div>
                <p className="mt-4 text-sm text-ink-soft leading-relaxed">
                  Gift 3 Explorer memberships to friends, families, or homeschool peers. When all 3 register, earn the <strong>Printed Parent&apos;s Guide</strong> completely free!
                </p>

                <ul className="mt-6 space-y-2.5 text-sm text-ink">
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> <strong>3 Gift Membership QR Codes</strong> to share
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> Dedicated <strong>Patrol Leader Hub</strong> to track friends
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> <strong>Free Printed Guide</strong> upon 3 family signups
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-spruce font-bold">✓</span> Fast-track your child&apos;s Biblical 700 fleet mission
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleCheckout("patrol")}
                disabled={loadingType !== null}
                className="btn-primary w-full mt-8 py-3.5 text-base bg-spruce hover:bg-spruce-dark text-paper font-black"
              >
                {loadingType === "patrol" ? "Connecting to Checkout…" : "Join Chief Scout Patrol ($10.00)"}
              </button>
            </div>
          </div>

          <div className="mt-12 text-center text-xs text-ink-soft">
            <Link href="/" className="font-semibold text-spruce hover:underline">
              ← Return to Book 1 Storefront
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
