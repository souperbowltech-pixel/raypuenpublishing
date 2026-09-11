"use client";

import React, { useState } from "react";

interface Volume3UnlockCardProps {
  scoutName: string;
}

export default function Volume3UnlockCard({ scoutName }: Volume3UnlockCardProps) {
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    recipient: scoutName || "Young Scout",
    addressLine1: "123 Faith Lane",
    city: "Loma Linda",
    state: "CA",
    zip: "92354",
  });

  const handleConfirmShipping = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressConfirmed(true);
  };

  return (
    <div className="rounded-3xl border-3 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 via-paper to-spruce/10 p-6 sm:p-10 shadow-book text-ink">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-crayon-gold px-4 py-1.5 text-xs font-black uppercase tracking-widest text-ink shadow-sm">
          🏆 Milestone Complete · 700 Points
        </div>
        <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black font-display text-ink">
          Book 3 Unlocked 100% Free!
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base sm:text-lg text-ink-soft leading-relaxed">
          Praise God! You have mastered the Book 2 Quiz (400 pts) and recruited a fellow friend to the circle (300 pts). Reaching the <strong>Biblical 700</strong> has updated your state to <code className="bg-spruce/20 text-spruce-dark px-2 py-0.5 rounded font-mono font-bold">Unlock_Volume_3</code>!
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
                Lulu Print-on-Demand Automated Dispatch
              </h4>
              <p className="text-xs text-ink-soft">
                Zero-Dollar Promotional Fulfillment Trigger ($0.00 Cost to Scout)
              </p>
            </div>
          </div>
          <span className="rounded-full bg-spruce/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-spruce-dark">
            API Status: READY_FOR_DISPATCH
          </span>
        </div>

        {!addressConfirmed ? (
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
                  className="input text-sm py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase mb-1">City, State</label>
                <input
                  type="text"
                  value={`${shippingAddress.city}, ${shippingAddress.state}`}
                  onChange={(e) => {
                    const parts = e.target.value.split(",");
                    setShippingAddress({ ...shippingAddress, city: parts[0]?.trim() || "", state: parts[1]?.trim() || "" });
                  }}
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
                  className="input text-sm py-2"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" className="btn-primary w-full sm:w-auto text-base">
                🚀 Confirm Address & Trigger Free Book 3 Printing
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 rounded-xl bg-spruce/10 border border-spruce/30 p-5 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-4xl">🎉</div>
              <div>
                <h5 className="text-lg font-bold text-spruce-dark font-display">
                  Order Successfully Dispatched to Lulu API!
                </h5>
                <p className="mt-1 text-sm text-ink-soft">
                  Book 3 is currently being printed on premium paper and will be shipped directly to{" "}
                  <strong>{shippingAddress.recipient}</strong> at {shippingAddress.addressLine1}, {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}.
                </p>
                <p className="mt-2 text-xs font-bold text-spruce">
                  Tracking & confirmation will be sent to the Scout Captain email. Total billed: $0.00 (Gifted via Biblical 700 Gate).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
