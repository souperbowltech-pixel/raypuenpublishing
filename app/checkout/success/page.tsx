import Link from "next/link";
import { publisherBrand } from "@/lib/book";
import { stripe } from "@/lib/stripe";
import { addSubscriberToMailerLite } from "@/lib/mailerlite";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string; channel?: string };
}) {
  const isWholesale = searchParams.channel === "wholesale";
  const sessionId = searchParams.session_id;

  // Direct sync on success page (guarantees MailerLite subscription even before webhook setup)
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || undefined;
      const orderType = session.metadata?.channel || (isWholesale ? "institutional_sponsorship" : "retail");

      if (customerEmail) {
        const groupId = isWholesale
          ? process.env.MAILERLITE_INSTITUTION_GROUP_ID
          : process.env.MAILERLITE_RETAIL_GROUP_ID;

        await addSubscriberToMailerLite({
          email: customerEmail,
          name: customerName,
          groupId: groupId || undefined,
          fields: {
            order_type: orderType,
            stripe_session_id: session.id,
          },
        });
      }
    } catch (e) {
      console.warn("Direct MailerLite sync warning:", e);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-2xl border border-ink/10 bg-paper p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-spruce-light text-3xl text-spruce-dark">
          ✓
        </div>

        <p className="eyebrow mb-2">Order Confirmed</p>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Thank you for your order!
        </h1>

        <p className="mt-4 text-base text-ink-soft leading-relaxed">
          {isWholesale
            ? "We have received your institutional bulk order. A confirmation email and invoice have been dispatched to your contact email address."
            : "Your payment has been successfully processed. Your coloring book is now being queued for printing and fulfillment."}
        </p>

        <div className="my-6 rounded-xl bg-ink/5 p-4 text-left text-sm text-ink space-y-2">
          <p className="font-bold">What happens next?</p>
          <ul className="list-disc list-inside space-y-1 text-ink-soft">
            <li>Printed on premium paper via our fulfillment facility</li>
            <li>Dispatched directly to your address within 2–3 business days</li>
            {isWholesale && (
              <li>
                Orders qualifying for the Teacher’s Master Manual will receive
                the download link via email shortly.
              </li>
            )}
          </ul>
        </div>

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
