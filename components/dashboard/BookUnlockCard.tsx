"use client";

import React, { useState } from "react";

/**
 * Automatic print-and-ship is switched on once IngramSpark is connected. Until
 * then the card never collects an address it can't use or claims a dispatch
 * that didn't happen: it tells the family the free book is reserved.
 */
const PRINT_FULFILLMENT_LIVE = false;

interface BookUnlockCardProps {
  scoutName: string;
  /** 2 = peer/700-point track, 3 = $40 Grandpa sponsorship track. */
  bookNumber: 2 | 3;
}

const COPY = {
  2: {
    badge: "🏆 Milestone Complete · 700 Points",
    heading: "Book 2 Unlocked 100% Free!",
    blurb: (
      <>
        Praise God! You read Book 1, mastered its comprehension quiz (400 pts) and
        recruited 2 friends to the circle (300 pts). Reaching the{" "}
        <strong>Biblical 700</strong> has updated your state to{" "}
        <code className="bg-spruce/20 text-spruce-dark px-2 py-0.5 rounded font-mono font-bold">
          Unlock_Volume_2
        </code>
        !
      </>
    ),
    fulfillmentNote: "Zero-Dollar Peer-Reward Fulfillment Trigger ($0.00 Cost to Scout)",
    cta: "🚀 Confirm Address & Trigger Free Book 2 Printing",
    gifted: "$0.00 (Gifted via Biblical 700 Gate)",
  },
  3: {
    badge: "💛 Grandpa Multiplier · $40 Sponsored",
    heading: "Book 3 Unlocked!",
    blurb: (
      <>
        A generous relative activated the <strong>$40 sponsorship link</strong>,
        which leap-frogs the peer track and pre-approves Book 3. Your state now
        reads{" "}
        <code className="bg-spruce/20 text-spruce-dark px-2 py-0.5 rounded font-mono font-bold">
          Unlock_Volume_3
        </code>
        !
      </>
    ),
    fulfillmentNote: "Sponsored Fulfillment Trigger ($0.00 Cost to Scout — covered by sponsor)",
    cta: "🚀 Confirm Address & Trigger Sponsored Book 3 Printing",
    gifted: "$0.00 (Covered by the $40 Grandpa Sponsorship)",
  },
} as const;

export default function BookUnlockCard({ scoutName, bookNumber }: BookUnlockCardProps) {
  const copy = COPY[bookNumber];
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    recipient: "",
    addressLine1: "",
    city: "",
    state: "",
    zip: "",
  });

  const handleConfirmShipping = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressConfirmed(true);
  };

  return (
    <div className="rounded-3xl border-3 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 via-paper to-spruce/10 p-6 sm:p-10 shadow-book text-ink">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-crayon-gold px-4 py-1.5 text-xs font-black uppercase tracking-widest text-ink shadow-sm">
          {copy.badge}
        </div>
        <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black font-display text-ink">
          {copy.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base sm:text-lg text-ink-soft leading-relaxed">
          {copy.blurb}
        </p>
      </div>

      <div className="mt-8 rounded-2xl border-2 border-spruce/30 bg-paper p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-spruce text-paper font-bold text-xl">
              📦
            </span>
            <div>
              <h4 className="text-base font-bold text-ink">
                IngramSpark Global Print &amp; Distribution
              </h4>
              <p className="text-xs text-ink-soft">
                {copy.fulfillmentNote}
              </p>
            </div>
          </div>
          {!PRINT_FULFILLMENT_LIVE && (
            <span className="rounded-full bg-crayon-gold/25 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-ink">
              Printing opens soon
            </span>
          )}
        </div>

        {!PRINT_FULFILLMENT_LIVE ? (
          <div className="mt-5 rounded-xl bg-spruce/10 border border-spruce/30 p-5">
            <h5 className="text-lg font-bold text-spruce-dark font-display">
              Your free Book {bookNumber} is reserved for Scout {scoutName || "Explorer"}!
            </h5>
            <p className="mt-1 text-sm text-ink-soft">
              Printing and shipping open soon. When they do, you&apos;ll confirm your
              shipping address right here, and your copy will be printed and mailed to
              you at no cost.
            </p>
          </div>
        ) : !addressConfirmed ? (
          <form onSubmit={handleConfirmShipping} className="mt-5 space-y-4">
            <p className="text-sm font-semibold text-ink">
              Please confirm the shipping destination for Scout <span className="text-clay font-bold">{scoutName || "Explorer"}</span>:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={shippingAddress.recipient}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, recipient: e.target.value })}
                  placeholder="Parent or guardian's name"
                  autoComplete="name"
                  className="input text-sm py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase mb-1">Street Address</label>
                <input
                  type="text"
                  value={shippingAddress.addressLine1}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })}
                  placeholder="e.g. 12 Oak Street"
                  autoComplete="address-line1"
                  className="input text-sm py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase mb-1">City</label>
                <input
                  type="text"
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  autoComplete="address-level2"
                  className="input text-sm py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase mb-1">State</label>
                <input
                  type="text"
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  autoComplete="address-level1"
                  className="input text-sm py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase mb-1">Postal / Zip Code</label>
                <input
                  type="text"
                  value={shippingAddress.zip}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
                  autoComplete="postal-code"
                  className="input text-sm py-2"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" className="btn-primary w-full sm:w-auto text-base">
                {copy.cta}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 rounded-xl bg-spruce/10 border border-spruce/30 p-5 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-4xl">🎉</div>
              <div>
                <h5 className="text-lg font-bold text-spruce-dark font-display">
                  Order Successfully Dispatched to IngramSpark!
                </h5>
                <p className="mt-1 text-sm text-ink-soft">
                  Book {bookNumber} is currently being printed on premium paper and will be shipped directly to{" "}
                  <strong>{shippingAddress.recipient}</strong> at {shippingAddress.addressLine1}, {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}.
                </p>
                <p className="mt-2 text-xs font-bold text-spruce">
                  Tracking &amp; confirmation will be sent to the Scout Captain email. Total billed: {copy.gifted}.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
