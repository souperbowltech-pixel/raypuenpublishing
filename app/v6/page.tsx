import type { Metadata } from "next";
import { VideoPage } from "@/components/video/VideoPage";

/**
 * puenpublishing.com/v6 — the welcome film.
 *
 * Unlike v1 to v5, this one is not a section-end reward. Ray asked for it at the
 * foot of the "This Journey Belongs to" page, so it is the first thing a parent
 * can reach when the book is opened. It is printed, which means the address is
 * fixed forever and the row in public.videos is what changes.
 *
 * force-dynamic is what makes that promise true — the page is rendered per
 * request, so an edited row is live immediately and is never served from a
 * build-time snapshot.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome — The Geezy Goober Explorer Fleet",
  // A print destination, not a page anyone should reach from a search result.
  robots: { index: false, follow: true },
};

export default function Video6Page() {
  return <VideoPage slug="v6" />;
}
