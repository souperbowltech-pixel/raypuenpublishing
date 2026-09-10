import {
  formatCurrency,
  wholesaleDiscountLabel,
  type WholesalePriceBreakdown,
} from "@/lib/pricing";

interface PricingCalculatorProps {
  breakdown: WholesalePriceBreakdown;
}

/**
 * Live order summary for the institutional portal. Presentational only — it
 * renders whatever breakdown it is handed by `calculateWholesalePrice`.
 *
 * The reward tier (fee waived + free manual) is styled as a celebratory GOLD
 * state so the buyer clearly sees what a 100+ order unlocks. Below the
 * threshold, a progress nudge shows exactly how many more copies are needed.
 */
export function PricingCalculator({ breakdown }: PricingCalculatorProps) {
  const {
    valid,
    quantity,
    unitPrice,
    subtotal,
    digitalFee,
    feeWaived,
    manualIncluded,
    total,
    freeManualThreshold,
    copiesUntilFreeManual,
  } = breakdown;

  const progressPct = Math.min(
    100,
    Math.round((quantity / freeManualThreshold) * 100)
  );

  return (
    <aside
      aria-label="Live order summary"
      className={[
        "rounded-xl2 border p-6 shadow-card transition-colors duration-500",
        feeWaived
          ? "border-crayon-gold bg-crayon-goldsoft"
          : "border-ink/10 bg-paper",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-bold text-ink">
          Order summary
        </h3>
        <span className="rounded-full bg-spruce px-3 py-1 text-xs font-bold text-paper">
          {wholesaleDiscountLabel()} off retail
        </span>
      </div>

      {/* Reward / progress banner --------------------------------------- */}
      {feeWaived ? (
        <div
          role="status"
          className="mt-4 rounded-xl border-2 border-crayon-gold bg-paper/70 p-4"
        >
          <p className="font-display text-lg font-bold text-clay-dark">
            🎉 You&apos;ve unlocked the bulk reward!
          </p>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-ink">
            <li>✓ {formatCurrency(0)} digital fee — waived</li>
            <li>✓ Teacher&apos;s Master Manual PDF — included free</li>
          </ul>
        </div>
      ) : valid ? (
        <div className="mt-4 rounded-xl border border-spruce/30 bg-spruce-light/40 p-4">
          <p className="text-sm font-semibold text-spruce-dark">
            Add{" "}
            <span className="font-display text-base text-ink">
              {copiesUntilFreeManual}
            </span>{" "}
            more{" "}
            {copiesUntilFreeManual === 1 ? "copy" : "copies"} to waive the{" "}
            {formatCurrency(digitalFee)} fee and get the Teacher&apos;s Master
            Manual free.
          </p>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress toward bulk reward"
          >
            <div
              className="h-full rounded-full bg-spruce transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-soft">
          Enter a quantity to see your total.
        </p>
      )}

      {/* Line items ----------------------------------------------------- */}
      <dl className="mt-5 space-y-2.5 text-sm">
        <Row
          label={`Books (${valid ? quantity : 0} × ${formatCurrency(unitPrice)})`}
          value={formatCurrency(subtotal)}
        />
        <Row
          label="Digital fee"
          value={
            feeWaived ? "Waived" : formatCurrency(digitalFee)
          }
          strike={feeWaived}
          highlight={feeWaived}
        />
        <Row
          label="Teacher's Master Manual (PDF)"
          value={manualIncluded ? "Included free" : "—"}
          highlight={manualIncluded}
        />
        <div className="!mt-4 border-t border-ink/15 pt-3">
          <Row
            label="Order total"
            value={formatCurrency(total)}
            large
          />
        </div>
      </dl>

      <p className="mt-4 text-xs text-ink-soft">
        Prices in USD. This is a quote — no payment is taken in Milestone 1.
      </p>
    </aside>
  );
}

function Row({
  label,
  value,
  large,
  strike,
  highlight,
}: {
  label: string;
  value: string;
  large?: boolean;
  strike?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={
          large
            ? "font-display text-lg font-bold text-ink"
            : "text-ink-soft"
        }
      >
        {label}
      </dt>
      <dd
        className={[
          large ? "font-display text-2xl font-bold text-ink" : "font-semibold",
          strike ? "text-ink-soft line-through" : "",
          highlight && !strike ? "text-spruce-dark" : "",
          !large && !highlight && !strike ? "text-ink" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
