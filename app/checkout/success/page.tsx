import Link from "next/link";
import { publisherBrand } from "@/lib/book";
import { stripe } from "@/lib/stripe";
import { confirmationFromPaymentStatus, type CheckoutConfirmation } from "@/lib/checkout-status";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string; type?: string; channel?: string };
}) {
  const sessionId = searchParams.session_id;
  let confirmation: CheckoutConfirmation = "unknown";
  let isWholesale = false;

  // Ask Stripe what actually happened. Anyone can open this URL with any
  // session_id, so nothing on this page may be decided by the query string.
  // (The buyer's MailerLite sync belongs to the webhook, which runs once per
  // paid event — doing it here too would re-fire on every page refresh.)
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      confirmation = confirmationFromPaymentStatus(session.payment_status);

      // Derive the channel from the authoritative Stripe session metadata,
      // never from the (spoofable / mismatched) query string.
      const orderType = session.metadata?.order_type || session.metadata?.channel || "retail";
      isWholesale = orderType === "institutional_sponsorship";
    } catch (e) {
      console.warn("[checkout/success] could not verify the Stripe session:", e);
      confirmation = "unknown";
    }
  }

  const isPaid = confirmation === "paid";

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-2xl border border-ink/10 bg-paper p-8 text-center shadow-card">
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
            isPaid ? "bg-spruce-light text-spruce-dark" : "bg-ink/5 text-ink-soft"
          }`}
        >
          {isPaid ? "✓" : "?"}
        </div>

        <p className="eyebrow mb-2">
          {isPaid ? "Order Confirmed" : "Order Not Confirmed"}
        </p>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          {isPaid ? "Thank you for your order!" : "We couldn't confirm this order"}
        </h1>

        <p className="mt-4 text-base text-ink-soft leading-relaxed">
          {isPaid
            ? isWholesale
              ? "We have received your institutional sponsorship. An itemised invoice for your records is being emailed to your contact address along with your payment receipt, and our team will follow up from there."
              : "Your payment has been successfully processed. Your coloring book is now being queued for printing and fulfillment."
            : confirmation === "unpaid"
            ? "Stripe has not recorded a completed payment for this order yet. If you closed the payment page before finishing, you can pick up where you left off from the storefront — and if you believe you were charged, email us and we'll check it for you."
            : "We couldn't check this order automatically. If you were charged, your receipt from Stripe is your confirmation and our team will follow up — nothing is lost."}
        </p>

        {/* Fulfilment promises appear only when Stripe confirms the payment. */}
        {isPaid && (
          <div className="my-6 rounded-xl bg-ink/5 p-4 text-left text-sm text-ink space-y-2">
            <p className="font-bold">What happens next?</p>
            <ul className="list-disc list-inside space-y-1 text-ink-soft">
              <li>Printed on premium paper via our fulfillment facility</li>
              <li>Dispatched directly to your address within 2–3 business days</li>
              {isWholesale && (
                <>
                  <li>An itemised invoice is emailed to you for your records</li>
                  <li>
                    Questions about your sponsorship? Email
                    support@puenpublishing.com and we&apos;ll help right away.
                  </li>
                </>
              )}
            </ul>
          </div>
        )}

        {!isPaid && (
          <div className="my-6 rounded-xl bg-ink/5 p-4 text-left text-sm text-ink-soft">
            Need a hand? Email support@puenpublishing.com and we&apos;ll sort it out
            for you.
          </div>
        )}

        <Link href="/" className="btn-primary inline-block w-full text-center">
          Return to Storefront
        </Link>

        <p className="mt-6 text-xs text-ink-soft/80 border-t border-ink/10 pt-4">
          {publisherBrand.fullCredit}
        </p>
      </div>
    </main>
  );
}
