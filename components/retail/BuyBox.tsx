"use client";

import { useState } from "react";
import { RETAIL_PRICE, formatCurrency } from "@/lib/pricing";
import { initiateRetailCheckout } from "@/lib/checkout";

/**
 * The retail purchase control. "Buy Now" triggers real Stripe Checkout.
 */
export function BuyBox() {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    const res = await initiateRetailCheckout(quantity);
    if (res.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div
      id="buy"
      className="rounded-xl2 border border-ink/10 bg-paper p-6 shadow-card"
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Retail price</p>
          <p className="font-display text-4xl font-bold text-ink">
            {formatCurrency(RETAIL_PRICE)}
          </p>
        </div>
        <span className="rounded-full bg-spruce-light px-3 py-1 text-xs font-bold text-spruce-dark">
          Free coloring fun
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <label htmlFor="retail-qty" className="text-sm font-semibold text-ink">
          Quantity
        </label>
        <div className="flex items-center rounded-full border border-ink/20">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={loading}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-10 w-10 rounded-l-full text-xl text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            −
          </button>
          <input
            id="retail-qty"
            type="number"
            min={1}
            disabled={loading}
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))
            }
            className="w-14 border-x border-ink/20 bg-transparent py-2 text-center text-base font-bold text-ink [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={loading}
            onClick={() => setQuantity((q) => q + 1)}
            className="h-10 w-10 rounded-r-full text-xl text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleBuy}
        className="btn-primary mt-5 w-full text-lg flex items-center justify-center gap-2 disabled:opacity-75"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-5 w-5 text-paper"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            Redirecting to Checkout...
          </>
        ) : (
          `Buy Now · ${formatCurrency(RETAIL_PRICE * quantity)}`
        )}
      </button>

      {error && (
        <p
          className="mt-3 text-center text-sm font-semibold text-clay-dark"
          role="alert"
        >
          {error}
        </p>
      )}

      <p className="mt-2 text-center text-xs text-ink-soft">
        Secure Stripe checkout · Ships in 2–3 business days
      </p>

      <div className="mt-3 rounded-lg border border-spruce/30 bg-spruce/10 px-3 py-2 text-center text-xs text-spruce-dark">
        <span className="font-semibold">🧪 Sandbox Test Mode:</span> Use card{" "}
        <code className="rounded bg-paper px-1 font-mono font-bold text-ink">4242 4242 4242 4242</code> (Do not enter real cards).
      </div>
    </div>
  );
}
