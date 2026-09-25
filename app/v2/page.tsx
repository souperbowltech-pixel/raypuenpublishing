import type { Metadata } from "next";
import { VideoPage } from "@/components/video/VideoPage";

/**
 * puenpublishing.com/v2 — printed inside the colouring book, so this address is
 * fixed forever. What plays here is the "v2" row in public.videos, which means a
 * new video is one edit in the table editor: no code change, no reprint.
 *
 * force-dynamic is what makes that promise true — the page is rendered per
 * request, so an edited row is live immediately and is never served from a
 * build-time snapshot.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Video 2 — The Geezy Goober Explorer Fleet",
  // A print destination, not a page anyone should reach from a search result.
  robots: { index: false, follow: true },
};

export default function Video2Page() {
  return <VideoPage slug="v2" />;
}
