/**
 * Tesler's law for the Patrol hub: the page carries the fiddly part, not the
 * parent. A leader may paste the whole link from their receipt email, the
 * link without https, the link inside a sentence, or just the token; all of
 * them open the same hub.
 */

// Tokens are "PT-" and base64url (lib/patrol-store.ts), so this shape alone
// finds one, and stops at the full stop, bracket or space that follows a link.
const TOKEN = /PT-[A-Za-z0-9_-]+/;

/** The Patrol token inside whatever was pasted, or the trimmed input if none is found. */
export function patrolTokenFrom(input: string): string {
  const text = input.trim();
  const found = TOKEN.exec(text)?.[0];
  if (found) return found;

  // A link whose token was percent-encoded: decode the query, then look again.
  const query = text.indexOf("?");
  if (query !== -1) {
    const fromLink = new URLSearchParams(text.slice(query + 1)).get("token") ?? "";
    const decoded = TOKEN.exec(fromLink)?.[0];
    if (decoded) return decoded;
  }
  return text;
}
