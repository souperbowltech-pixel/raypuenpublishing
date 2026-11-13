/**
 * The two decisions the /library page makes in the browser, kept here so they
 * are tested on their own.
 */

/** The code carried in a link like /library#code=ABCD-2345-WXYZ, or null. */
export function codeFromFragment(hash: string): string | null {
  const code = new URLSearchParams(hash.replace(/^#/, "")).get("code");
  return code ? code.slice(0, 64) : null;
}

/**
 * Only follow a download link over https. The link comes from our own server,
 * so this is a second lock, not the first. Its host is not checked here: the
 * server signs with its own Supabase address, which the browser cannot know
 * for certain, and a mismatch would refuse every real download.
 */
export function isSafeDownloadUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
