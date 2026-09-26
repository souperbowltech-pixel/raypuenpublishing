"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { publisherBrand } from "@/lib/book";

type Field = "childFirstName" | "parentEmail" | "isParentOrGuardian";

function StartForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || searchParams.get("referral") || "";
  const giftCode = searchParams.get("gift") || searchParams.get("giftCode") || "";

  const [childFirstName, setChildFirstName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [isParentOrGuardian, setIsParentOrGuardian] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; field?: Field } | null>(null);

  // Already registered on this device: go straight to the dashboard.
  useEffect(() => {
    fetch("/api/family/me", { cache: "no-store" })
      .then((r) => {
        if (r.ok) router.replace("/dashboard/book2");
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/family/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childFirstName,
          parentEmail,
          isParentOrGuardian,
          referralCode: refCode || undefined,
          giftCode: giftCode || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        router.replace("/dashboard/book2");
        return;
      }
      setError({ message: data?.error || "Something went wrong. Please try again.", field: data?.field });
    } catch {
      setError({ message: "Network error. Please check your connection and try again." });
    }
    setSubmitting(false);
  };

  const invalid = (f: Field) => (error?.field === f ? true : undefined);

  return (
    <main className="min-h-screen bg-paper px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-lg">
        <div className="rounded-3xl border-2 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 to-paper p-6 sm:p-10 shadow-book">
          <p className="eyebrow text-center">The Geezy Goober Explorer Fleet</p>
          <h1 className="mt-2 text-center font-display text-3xl sm:text-4xl font-black text-ink">
            Welcome to the Fleet!
          </h1>
          <p className="mt-3 text-center text-ink-soft">
            Set up your child&apos;s sticker album, quiz and rewards in under a minute.
          </p>

          {giftCode && (
            <div className="mt-4 rounded-xl border border-crayon-gold/40 bg-crayon-goldsoft/30 p-3 text-center text-xs font-bold text-ink">
              🎁 Redeeming your gifted Chief Scout Patrol membership!
            </div>
          )}

          {!giftCode && refCode && (
            <div className="mt-4 rounded-xl border border-spruce/30 bg-spruce/10 p-3 text-center text-xs font-bold text-spruce-dark">
              🧭 Joining via a friend&apos;s Quest Captain invitation!
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="childFirstName" className="block font-display text-lg font-bold text-ink">
                What is your Chief Explorer&apos;s first name?
              </label>
              <input
                id="childFirstName"
                name="childFirstName"
                type="text"
                value={childFirstName}
                onChange={(e) => setChildFirstName(e.target.value)}
                maxLength={30}
                autoComplete="off"
                aria-invalid={invalid("childFirstName")}
                aria-describedby="childFirstName-hint"
                className="input mt-2 text-lg"
                required
              />
              <p id="childFirstName-hint" className="mt-1 text-xs text-ink-soft">
                First name only. We never ask for a last name.
              </p>
            </div>

            <div>
              <label htmlFor="parentEmail" className="block text-sm font-bold text-ink">
                Your email (parent or guardian)
              </label>
              <input
                id="parentEmail"
                name="parentEmail"
                type="email"
                inputMode="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={invalid("parentEmail")}
                aria-describedby="parentEmail-hint"
                className="input mt-2"
                required
              />
              <p id="parentEmail-hint" className="mt-1 text-xs text-ink-soft">
                Used only to reach you about your child&apos;s journey and the Parent&apos;s Guide.
              </p>
            </div>

            <label htmlFor="isParentOrGuardian" className="flex items-start gap-3 text-sm text-ink">
              <input
                id="isParentOrGuardian"
                type="checkbox"
                checked={isParentOrGuardian}
                onChange={(e) => setIsParentOrGuardian(e.target.checked)}
                aria-invalid={invalid("isParentOrGuardian")}
                className="mt-0.5 h-5 w-5 accent-spruce"
              />
              <span>I am this child&apos;s parent or guardian.</span>
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-clay/10 border border-clay/30 p-3 text-sm font-semibold text-clay-dark">
                {error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Setting up your album…" : "Start the adventure"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-soft">
            This device will stay signed in, so your child can pick up where they left off.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft/80">{publisherBrand.fullCredit}</p>
        <p className="mt-2 text-center">
          <Link href="/" className="text-xs font-semibold text-spruce hover:underline">
            ← Back to the store
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-paper px-4 py-12 sm:py-16" />}>
      <StartForm />
    </Suspense>
  );
}
