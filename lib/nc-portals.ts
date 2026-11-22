import { NEIGHBORHOOD_VIDEOS, neighborhoodEmbedUrl } from "@/lib/neighborhood";

/** These addresses go in the NC book. Keep them stable when a film is replaced. */
export const NC_PORTALS = [
  { slug: "welcome", title: "Welcome to the Neighborhood", label: "Welcome Video", kind: "video", youtubeId: NEIGHBORHOOD_VIDEOS[0].youtubeId },
  { slug: "video-1", title: "The Call to Bethlehem", label: "Sectional Lesson 1", kind: "video", youtubeId: NEIGHBORHOOD_VIDEOS[1].youtubeId },
  { slug: "video-2", title: "The Secret Tools", label: "Sectional Lesson 2", kind: "video", youtubeId: "pSd3ZForw2U" },
  { slug: "video-3", title: "The Royal Challenge", label: "Sectional Lesson 3", kind: "video", youtubeId: "1g63wcScFn8" },
  { slug: "video-4", title: "The Valley Overthrow", label: "Sectional Lesson 4", kind: "video", youtubeId: "ho6rJ1x4fOI" },
  { slug: "bring-two-friends", title: "Bring Two Friends!", label: "Bring Two Friends", kind: "invite", youtubeId: null },
  { slug: "join", title: "Join the Secret Scout Club", label: "Family Registration", kind: "join", youtubeId: null },
] as const;

export type NcPortal = typeof NC_PORTALS[number];
export function ncPortal(raw: unknown): NcPortal | null {
  return typeof raw === "string" ? NC_PORTALS.find((entry) => entry.slug === raw) ?? null : null;
}
export function ncPortalPath(portal: NcPortal): string { return `/nc/${portal.slug}`; }
export function ncPortalEmbed(portal: NcPortal): string | null {
  return portal.youtubeId ? neighborhoodEmbedUrl({ title: portal.title, youtubeId: portal.youtubeId }) : null;
}
