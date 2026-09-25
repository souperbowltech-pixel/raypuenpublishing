import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { VideoView } from "@/lib/videos";

/**
 * What the printed pages actually render, without a database.
 *
 * `getVideo` is mocked because the decision it makes is already covered in
 * `lib/videos.test.ts`; what is under test here is the markup each decision
 * produces — above all that the live state embeds the player instead of sending
 * a child off to the host's own site.
 */
const getVideo = vi.fn<(slug: string) => Promise<VideoView>>();
vi.mock("@/lib/videos", () => ({ getVideo: (slug: string) => getVideo(slug) }));

// next/link is a client component; only the anchor it produces matters here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { VideoPage } = await import("@/components/video/VideoPage");

const render = async (slug = "v1") =>
  renderToStaticMarkup(await VideoPage({ slug: slug as "v1" }));

const LIVE: VideoView = {
  state: "live",
  slug: "v1",
  title: "Meet Geezy Goober",
  provider: "youtube",
  embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1",
};

const PENDING: VideoView = {
  state: "pending",
  slug: "v1",
  title: "Video 1",
  reason: "not-live",
};

beforeEach(() => { getVideo.mockReset(); });

describe("VideoPage — live", () => {
  beforeEach(() => { getVideo.mockResolvedValue(LIVE); });

  it("embeds the player rather than linking out to it", async () => {
    const html = await render();
    expect(html).toContain('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    // The child must never be handed a link that leaves the site.
    expect(html).not.toContain('<a href="https://');
    expect(html).not.toContain("youtube.com/watch");
  });

  it("gives the frame an accessible title and lets it go fullscreen", async () => {
    const html = await render();
    expect(html).toContain('title="Meet Geezy Goober"');
    expect(html).toContain("allowfullscreen");
    expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"');
  });

  it("shows the video's own title as the heading", async () => {
    expect(await render()).toContain("Meet Geezy Goober");
  });

  it("still offers the way into the sticker album", async () => {
    expect(await render()).toContain('href="/start"');
  });

  it("does not tell a reader to wait for a video that is already playing", async () => {
    const html = await render();
    expect(html).not.toContain("While you wait");
    expect(html).toContain("Start the sticker album");
  });
});

describe("VideoPage — pending", () => {
  beforeEach(() => { getVideo.mockResolvedValue(PENDING); });

  it("shows the waiting screen and no player at all", async () => {
    const html = await render();
    expect(html).toContain("This video is on its way!");
    expect(html).not.toContain("<iframe");
  });

  it("reassures the reader they are on the right page, and prints the address", async () => {
    const html = await render();
    expect(html).toContain("this is the right page");
    expect(html).toContain("puenpublishing.com/v1");
  });

  it("never shows the internal reason for waiting", async () => {
    const html = await render();
    for (const reason of ["not-live", "no-row", "table-missing", "database-error", "database-off"]) {
      expect(html).not.toContain(reason);
    }
  });

  it("sends the reader on to register instead of dead-ending", async () => {
    const html = await render();
    expect(html).toContain('href="/start"');
    expect(html).toContain("While you wait");
  });

  it("prints the address of whichever page it is", async () => {
    getVideo.mockResolvedValue({ ...PENDING, slug: "v4", title: "Video 4" });
    const html = await render("v4");
    expect(html).toContain("puenpublishing.com/v4");
  });
});

describe("VideoPage — both states", () => {
  it("carries the publisher credit line", async () => {
    for (const view of [LIVE, PENDING]) {
      getVideo.mockResolvedValue(view);
      expect(await render()).toContain("Published by Regency Press under the Puen Publishing Imprint");
    }
  });

  it("asks the database for the slug it was given", async () => {
    getVideo.mockResolvedValue(PENDING);
    await render("v3");
    expect(getVideo).toHaveBeenCalledWith("v3");
  });
});
