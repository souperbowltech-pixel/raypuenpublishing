/**
 * What the checkout success page is allowed to tell a customer.
 *
 * This is decided from Stripe's own record of the session, never from the URL.
 * Anyone can open /checkout/success, with any session_id or none, so trusting
 * the query string is how a visitor who never paid ends up being told their
 * book is being printed.
 */
export type CheckoutConfirmation =
  /** Stripe confirms the money arrived — fulfilment promises are safe to show. */
  | 'paid'
  /** Stripe has the session and says it is not paid. */
  | 'unpaid'
  /** No session id, or we could not reach Stripe. We genuinely do not know. */
  | 'unknown';

export function confirmationFromPaymentStatus(
  paymentStatus: string | null | undefined
): CheckoutConfirmation {
  // `no_payment_required` is what Stripe reports for a fully discounted order,
  // which is a completed purchase even though nothing was charged.
  if (paymentStatus === 'paid' || paymentStatus === 'no_payment_required') return 'paid';

  // Only Stripe's one documented not-paid value is treated as not paid. Anything
  // we do not recognise — a status Stripe adds later, or one belonging to a
  // delayed-settlement method — falls through to 'unknown', because wrongly
  // telling a real customer their payment did not happen is its own failure.
  if (paymentStatus === 'unpaid') return 'unpaid';
  return 'unknown';
}
