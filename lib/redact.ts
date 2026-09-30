/**
 * What may be written down when something goes wrong.
 *
 * Logs and alerts leave the building: an alert is POSTed to a chat webhook and a
 * log line sits in Vercel's history. A customer's email address and a scout
 * token do not belong in either — the token in particular is a credential that
 * can change a child's progress, so one alert in a chat channel would hand it to
 * everyone in that channel (AUDIT SEC-05).
 *
 * Enough is kept to match a record against the database when diagnosing; never
 * enough to identify or impersonate anybody.
 */

/** `caroline@example.com` becomes `c***@example.com`. */
export function redactEmail(address: unknown): string {
  if (typeof address !== "string" || !address) return "(none)";
  const at = address.lastIndexOf("@");
  if (at < 1) return "(invalid)";
  return `${address[0]}***${address.slice(at)}`;
}

/**
 * A credential shortened to something you can still match a row on. The first
 * four characters are enough to find it with a LIKE query and far too few to
 * use.
 */
export function redactToken(token: unknown): string {
  if (typeof token !== "string" || !token) return "(none)";
  if (token.length <= 4) return "****";
  return `${token.slice(0, 4)}…(${token.length} chars)`;
}
