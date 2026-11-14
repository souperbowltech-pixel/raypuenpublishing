"use client";

import React, { useState } from "react";
import { SPONSOR_TIERS, SponsorTier, formatCurrency } from "@/lib/pricing";
import { Spinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/ui/Reveal";

export default function WholesaleForm() {
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(2);
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState({
    line1: "",
    city: "",
    state: "",
    zip: "",
  });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const tier = SPONSOR_TIERS[selectedTier];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerError(null);

    if (tier.requiresShipping && (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.zip)) {
      setServerError("Please provide a shipping address to receive your complimentary sponsor copy.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/checkout/wholesale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: selectedTier,
          institution: {
            name: orgName,
            contactName,
            email,
            phone,
          },
          // Enter in the State box sends the form without leaving it, so capitalise here too.
          shippingAddress: tier.requiresShipping
            ? { ...shippingAddress, state: shippingAddress.state.trim().toUpperCase() }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setServerError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 rounded-2xl border border-ink/10 bg-paper p-6 sm:p-10 shadow-card">
      <div>
        <span className="eyebrow">Nepal Flood Recovery & Mission Multiplication</span>
        <h2 className="mt-1 text-2xl sm:text-3xl font-bold font-display text-ink">
          Select Your Sponsorship Package
        </h2>
        <p className="mt-2 text-sm sm:text-base text-ink-soft">
          We apply a 1:1 match to double every package! Tiers 2 & 3 include a complimentary author copy shipped to you as a Premium Sponsor.
        </p>
      </div>

      {/* 3 Flat Tiers Selection */}
      <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([1, 2, 3] as const).map((tId) => {
          const t = SPONSOR_TIERS[tId];
          const isSelected = selectedTier === tId;

          return (
            <div
              key={tId}
              onClick={() => setSelectedTier(tId)}
              className={`lift cursor-pointer rounded-xl border-2 p-5 flex flex-col justify-between ${
                isSelected
                  ? "border-spruce bg-spruce/5 ring-2 ring-spruce/30 shadow-md"
                  : "border-ink/10 bg-paper-deep/40 hover:border-ink/20"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-spruce font-mono">
                    Tier {tId}
                  </span>
                  {t.isPremiumSponsor && (
                    <span className="rounded-full bg-crayon-gold/20 px-2 py-0.5 text-[10px] font-black uppercase text-ink">
                      Premium Sponsor
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <span className="text-3xl font-black font-display text-ink">
                    {formatCurrency(t.flatPrice)}
                  </span>
                  <span className="text-xs text-ink-soft block mt-0.5">
                    Flat Rate Sponsorship
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-paper p-3 border border-ink/10 text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-ink">
                    <span>You Sponsor:</span>
                    <span className="font-bold">{t.booksSponsored} Books</span>
                  </div>
                  <div className="flex justify-between font-bold text-spruce">
                    <span>1:1 Match Prints:</span>
                    <span>{t.totalPrintedWithMatch} Books Total</span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-ink-soft leading-relaxed">
                  {t.description}
                </p>
              </div>

              <button
                type="button"
                className={`mt-4 min-h-11 w-full rounded-lg py-2.5 text-xs font-bold transition ${
                  isSelected ? "bg-spruce text-paper" : "bg-ink/10 text-ink"
                }`}
              >
                {isSelected ? "✓ Selected Tier" : "Choose Tier"}
                {/* The visible words start the name; this says which tier. */}
                <span className="sr-only">{` ${tId}, ${formatCurrency(t.flatPrice)}`}</span>
              </button>
            </div>
          );
        })}
      </Reveal>

      {/* Contact Fields */}
      <div className="space-y-4 pt-4 border-t border-ink/10">
        <h3 className="text-lg font-bold font-display text-ink">
          Sponsor / Organization Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ws-org" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">
              Organization / Church / Co-Op Name *
            </label>
            <input
              type="text"
              required
              id="ws-org"
              autoComplete="organization"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="input text-sm"
              placeholder="e.g. Grace Homeschool Co-op"
            />
          </div>

          <div>
            <label htmlFor="ws-name" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              required
              id="ws-name"
              autoComplete="name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input text-sm"
              placeholder="e.g. Sarah Jenkins"
            />
          </div>

          <div>
            <label htmlFor="ws-email" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              id="ws-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input text-sm"
              placeholder="sarah@example.com"
            />
          </div>

          <div>
            <label htmlFor="ws-phone" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              id="ws-phone"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input text-sm"
              placeholder="(555) 000-0000"
            />
          </div>
        </div>
      </div>

      {/* Shipping Address for Tiers 2 & 3 */}
      {tier.requiresShipping && (
        <div className="space-y-4 rounded-xl border border-crayon-gold/40 bg-crayon-goldsoft/20 p-5">
          <div>
            <span className="inline-block rounded-full bg-crayon-gold px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-ink mb-1">
              Premium Sponsor Benefit
            </span>
            <h4 className="text-base font-bold font-display text-ink">
              Where should we ship your 1 Free Complimentary Copy?
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label htmlFor="ws-street" className="block text-xs font-bold text-ink-soft mb-1">Street Address *</label>
              <input
                type="text"
                required
                id="ws-street"
                autoComplete="shipping address-line1"
                value={shippingAddress.line1}
                onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                className="input text-sm bg-paper"
                placeholder="123 Faith Lane"
              />
            </div>

            <div>
              <label htmlFor="ws-city" className="block text-xs font-bold text-ink-soft mb-1">City *</label>
              <input
                type="text"
                required
                id="ws-city"
                autoComplete="shipping address-level2"
                value={shippingAddress.city}
                onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                className="input text-sm bg-paper"
                placeholder="City"
              />
            </div>

            <div>
              <label htmlFor="ws-state" className="block text-xs font-bold text-ink-soft mb-1">State *</label>
              <input
                type="text"
                required
                id="ws-state"
                autoComplete="shipping address-level1"
                autoCapitalize="characters"
                value={shippingAddress.state}
                onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                // Capitalised when the box is left, not while typing, so the caret never jumps.
                onBlur={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value.trim().toUpperCase() })}
                className="input text-sm bg-paper"
                placeholder="State"
              />
            </div>

            <div>
              <label htmlFor="ws-zip" className="block text-xs font-bold text-ink-soft mb-1">Zip Code *</label>
              <input
                type="text"
                required
                id="ws-zip"
                autoComplete="shipping postal-code"
                inputMode="numeric"
                value={shippingAddress.zip}
                onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
                className="input text-sm bg-paper"
                placeholder="Zip"
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full text-lg flex items-center justify-center gap-2"
        >
          {loading ? <><Spinner className="h-4 w-4" /> Preparing Secure Checkout...</> : `Sponsor Tier ${selectedTier} · ${formatCurrency(tier.flatPrice)}`}
        </button>

        {serverError && (
          <p className="mt-3 text-center text-sm font-semibold text-clay-dark" role="alert">
            {serverError}
          </p>
        )}

        <div className="mt-3 rounded-lg border border-spruce/30 bg-spruce/10 px-3 py-2 text-center text-xs text-spruce-dark">
          <span className="font-semibold">🧪 Sandbox Test Mode:</span> Use test card{" "}
          <code className="rounded bg-paper px-1 font-mono font-bold text-ink">4242 4242 4242 4242</code>.
        </div>
      </div>
    </form>
  );
}

export { WholesaleForm };
