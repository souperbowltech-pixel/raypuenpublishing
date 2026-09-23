"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { GRANDPA_SPONSOR_PRICE } from "@/lib/gamification";
import { publisherBrand } from "@/lib/book";

const SHARE_CODE_REGEX = /^GG-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const DEMO_TOKEN = "CAPTAIN-RAY-700";

// "unlock-pending": the payment definitely succeeded, but writing the unlock did
// not. Telling this sponsor Book 3 is unlocked would be exactly the kind of
// false confirmation the checkout success page was fixed to stop.
type Stage = "form" | "confirming" | "thanks" | "unlock-pending" | "unconfirmed";

/**
 * Public landing page a relative reaches by scanning the Grandpa QR code (or
 * opening the shared link). It carries only the child's public share code
 * (`?code=GG-…`) and starts the $40 sponsorship checkout; after paying, Stripe
 * sends the sponsor back here (`?done=1&session_id=…`) to confirm the unlock.
 */
export default function SponsorLandingPage() {
  const [code, setCode] = useState("");
  const [demoToken, setDemoToken] = useState("");
  const [scoutName, setScoutName] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCode((params.get("code") || "").trim().toUpperCase());
    setDemoToken(params.get("token") === DEMO_TOKEN ? DEMO_TOKEN : "");
    setScoutName((params.get("scout") || "").replace(/[<>]/g, "").slice(0, 30));

    const sessionId = params.get("session_id");
    if (params.get("done") === "1" && sessionId) {
      setStage("confirming");
      fetch("/api/checkout/sponsor/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.scoutName) setScoutName(d.scoutName);
          if (d?.paid && d?.unlockPending) setStage("unlock-pending");
          else setStage(d?.paid ? "thanks" : "unconfirmed");
        })
        .catch(() => setStage("unconfirmed"));
    }
  }, []);

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(GRANDPA_SPONSOR_PRICE);

  const linkValid = SHARE_CODE_REGEX.test(code) || Boolean(demoToken);

  const handleSponsor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoToken ? { scoutToken: demoToken } : { scoutCode: code }),
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

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-2xl border-2 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 to-paper p-8 text-center shadow-book">
        <div className="text-5xl mb-3">💛</div>
        <p className="eyebrow mb-2">The Grandpa Multiplier</p>

        {stage === "form" && (
          <>
            <h1 className="font-display text-3xl font-black text-ink sm:text-4xl">
              Sponsor Book 3 {scoutName ? `for ${scoutName}` : "for a young Scout"}
            </h1>
            <p className="mt-4 text-base text-ink-soft leading-relaxed">
              A single <strong>{price}</strong> gift instantly pre-approves and unlocks
              Book 3 free for this Scout — a wonderful way for a grandparent, relative,
              or family friend to cheer them on.
            </p>

            {linkValid ? (
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
          </>
        )}

        {stage === "confirming" && (
          <h1 className="font-display text-2xl font-black text-ink">Confirming your gift…</h1>
        )}

        {stage === "thanks" && (
          <>
            <h1 className="font-display text-3xl font-black text-ink sm:text-4xl">Thank you!</h1>
            <p className="mt-4 text-base text-ink-soft leading-relaxed">
              Your {price} gift is confirmed and Book 3 is now unlocked
              {scoutName ? ` for ${scoutName}` : ""}. They&apos;ll see it on their dashboard
              the next time they open it.
            </p>
          </>
        )}

        {stage === "unlock-pending" && (
          <>
            <h1 className="font-display text-3xl font-black text-ink sm:text-4xl">Thank you!</h1>
            <p className="mt-4 text-base text-ink-soft leading-relaxed">
              Your {price} gift went through. We&apos;re still finishing the unlock on
              {scoutName ? ` ${scoutName}'s` : " the child's"} dashboard — our team has
              been alerted and it will be in place shortly. Nothing more is needed from
              you, and you have not been charged twice.
            </p>
          </>
        )}

        {stage === "unconfirmed" && (
          <>
            <h1 className="font-display text-2xl font-black text-ink">Almost there</h1>
            <p className="mt-4 text-base text-ink-soft leading-relaxed">
              We couldn&apos;t confirm the payment on this page yet. If you completed
              checkout, Book 3 will still unlock automatically within a few minutes.
            </p>
          </>
        )}

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
