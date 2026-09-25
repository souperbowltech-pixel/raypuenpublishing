import { supabase } from "@/lib/supabase";
import { alertFailure } from "@/lib/alerts";

/**
 * The five video addresses printed inside the colouring book.
 *
 * `puenpublishing.com/v1` ... `/v5` go on paper — a QR code plus a typed line at
 * the bottom of a book page — so the addresses can never change. What plays
 * behind each one is a row in `public.videos`, so swapping a video is one edit in
 * the Supabase table editor: no code change, no deploy, no reprint.
 *
 * The rule that shapes every decision below: a printed link must never be dead.
 * Every failure — no row, no table, no database, a bad id, a slow query —
 * resolves to the friendly "on its way" screen, never to a 404 or an error.
 */
export const VIDEO_SLUGS = ["v1", "v2", "v3", "v4", "v5"] as const;
export type VideoSlug = (typeof VIDEO_SLUGS)[number];

export type VideoProvider = "none" | "youtube" | "cloudflare" | "bunny" | "vimeo";

/** Heading used until the row carries a real title from Ray. */
const DEFAULT_TITLE: Record<VideoSlug, string> = {
  v1: "Video 1",
  v2: "Video 2",
  v3: "Video 3",
  v4: "Video 4",
  v5: "Video 5",
};

/** Shape of a `public.videos` row as PostgREST returns it. */
export interface VideoRow {
  slug?: string | null;
  title?: string | null;
  provider?: string | null;
  video_id?: string | null;
  status?: string | null;
}

/** Why a page is showing the waiting screen. Diagnostics only — never shown raw. */
export type PendingReason =
  | "no-row" // the table exists but this slug has no row yet
  | "not-live" // the row is still status='pending' — the normal case before launch
  | "no-video-id" // marked live but no id was filled in
  | "bad-video-id" // the id does not match the provider's format
  | "unknown-provider" // a provider value this build cannot embed
  | "table-missing" // the migration has not been applied to this database yet
  | "database-off" // Supabase not configured (local dev)
  | "database-error"; // timeout, network failure or permission problem

export type VideoView =
  | { state: "live"; slug: VideoSlug; title: string; provider: VideoProvider; embedUrl: string }
  | { state: "pending"; slug: VideoSlug; title: string; reason: PendingReason };

export function isVideoSlug(value: unknown): value is VideoSlug {
  return typeof value === "string" && (VIDEO_SLUGS as readonly string[]).includes(value);
}

/**
 * How each host is embedded. Two rules, both deliberate:
 *
 * 1. Embed, never redirect. A redirect sends a child off to YouTube's own site
 *    with its recommendations; an embed keeps them on the book's page.
 * 2. The id is validated against the host's own format before it reaches an
 *    `iframe src`. This table is edited by hand, so a typo, a pasted full URL or
 *    anything hostile must fail closed to the waiting screen.
 */
const EMBED: Record<Exclude<VideoProvider, "none">, { pattern: RegExp; url: (id: string) => string }> = {
  // YouTube ids are 11 characters today; the range is a little wider on purpose.
  // youtube-nocookie sets no tracking cookie until the child presses play.
  youtube: {
    pattern: /^[A-Za-z0-9_-]{6,24}$/,
    url: (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
  },
  // Cloudflare Stream video UID: 32 hexadecimal characters.
  cloudflare: {
    pattern: /^[a-f0-9]{32}$/,
    url: (id) => `https://iframe.videodelivery.net/${id}`,
  },
  // Bunny Stream needs both parts, so the id field carries "<libraryId>/<videoGuid>".
  bunny: {
    pattern: /^[0-9]{1,10}\/[0-9a-fA-F-]{16,60}$/,
    url: (id) => `https://iframe.mediadelivery.net/embed/${id}`,
  },
  // Vimeo ids are numeric. dnt=1 asks Vimeo not to track the viewer.
  vimeo: {
    pattern: /^[0-9]{6,15}$/,
    url: (id) => `https://player.vimeo.com/video/${id}?dnt=1`,
  },
};

/** Player URL for a validated provider/id pair, or null if either is unusable. */
export function buildEmbedUrl(
  provider: string | null | undefined,
  videoId: string | null | undefined
): string | null {
  if (!provider || provider === "none") return null;
  const embed = EMBED[provider as Exclude<VideoProvider, "none">];
  if (!embed) return null;
  const id = (videoId ?? "").trim();
  if (!embed.pattern.test(id)) return null;
  return embed.url(id);
}

function pending(slug: VideoSlug, reason: PendingReason, title?: string | null): VideoView {
  return { state: "pending", slug, title: title?.trim() || DEFAULT_TITLE[slug], reason };
}

/**
 * Decide what a page shows from the row it was given. Pure — all the branching
 * lives here so it can be tested without a database.
 */
export function resolveVideo(slug: VideoSlug, row: VideoRow | null | undefined): VideoView {
  if (!row) return pending(slug, "no-row");

  const title = row.title?.trim() || DEFAULT_TITLE[slug];
  if (row.status !== "live") return pending(slug, "not-live", title);

  const provider = row.provider ?? "none";
  if (provider === "none") return pending(slug, "no-video-id", title);
  if (!(provider in EMBED)) return pending(slug, "unknown-provider", title);
  if (!row.video_id?.trim()) return pending(slug, "no-video-id", title);

  const embedUrl = buildEmbedUrl(provider, row.video_id);
  if (!embedUrl) return pending(slug, "bad-video-id", title);

  return { state: "live", slug, title, provider: provider as VideoProvider, embedUrl };
}

/** A missing table means the migration has not been applied to this database. */
export function isMissingTableError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /schema cache|does not exist/i.test(error.message ?? "");
}

/**
 * A printed page must render quickly even when the database is unwell, so the
 * query gets a deadline and a slow database becomes the waiting screen.
 */
const DB_TIMEOUT_MS = 4_000;

/** One alert per reason per instance — a scanned QR must not become an alert storm. */
const alerted = new Set<string>();
function alertOnce(reason: PendingReason, detail: Record<string, unknown>): void {
  if (alerted.has(reason)) return;
  alerted.add(reason);
  void alertFailure(`Video page fell back to the waiting screen (${reason})`, detail);
}

/** Read one printed address's row and decide what the page shows. Never throws. */
export async function getVideo(slug: VideoSlug): Promise<VideoView> {
  if (!supabase) return pending(slug, "database-off");

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = supabase
      .from("videos")
      .select("slug, title, provider, video_id, status")
      .eq("slug", slug)
      .maybeSingle();

    const deadline = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), DB_TIMEOUT_MS);
    });

    const result = await Promise.race([query, deadline]);
    if (result === "timeout") {
      alertOnce("database-error", { slug, error: `videos lookup exceeded ${DB_TIMEOUT_MS}ms` });
      return pending(slug, "database-error");
    }

    if (result.error) {
      if (isMissingTableError(result.error)) {
        // Expected between deploying this code and applying the migration.
        console.error(`[videos] public.videos is missing; /${slug} is showing the waiting screen`);
        return pending(slug, "table-missing");
      }
      alertOnce("database-error", { slug, error: result.error.message });
      return pending(slug, "database-error");
    }

    return resolveVideo(slug, result.data as VideoRow | null);
  } catch (err) {
    alertOnce("database-error", { slug, error: err instanceof Error ? err.message : String(err) });
    return pending(slug, "database-error");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
