/**
 * Authoritative site URL / origin helper.
 *
 * SEC-01: Never trust client-supplied request Origin / Host headers to build
 * Stripe checkout success and cancel redirect URLs. An attacker could spoof the
 * header to trick customers into redirecting to a phishing domain after payment.
 */
export function getSiteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  return "https://puenpublishing.com";
}
