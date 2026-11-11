import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveVideo, type VideoView } from "@/lib/videos";
import { BonusVideo } from "@/components/start/BonusVideo";

/**
 * The Bonus Video plays on /start, the page behind the last code in the book.
 * Until its row is live the Start page must look exactly as it does today.
 */
describe("BonusVideo", () => {
  it("embeds the player once the row is live", () => {
    const view = resolveVideo("bonus", {
      slug: "bonus",
      title: "The 700-Point Book 2 Challenge",
      provider: "youtube",
      video_id: "kJ5uUvPdUEE",
      status: "live",
    });
    const html = renderToStaticMarkup(<BonusVideo view={view} />);
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/kJ5uUvPdUEE?');
    expect(html).toContain("The 700-Point Book 2 Challenge");
  });

  it.each([
    ["no row yet", null],
    ["still pending", { slug: "bonus", status: "pending" }],
    ["a pasted full link instead of an id", { slug: "bonus", provider: "youtube", video_id: "https://youtu.be", status: "live" }],
  ])("renders nothing when %s", (_label, row) => {
    expect(renderToStaticMarkup(<BonusVideo view={resolveVideo("bonus", row)} />)).toBe("");
  });

  it("falls back to a plain title when the row has none", () => {
    expect(resolveVideo("bonus", null).title).toBe("Bonus Video");
  });
});

/**
 * The Start page itself, with the database decision mocked. It lives here because
 * the vitest include list does not cover app/.
 */
const getVideo = vi.fn<(slug: string, timeoutMs?: number) => Promise<VideoView>>();
vi.mock("@/lib/videos", async (orig) => ({
  ...(await orig<typeof import("@/lib/videos")>()),
  getVideo: (slug: string, timeoutMs?: number) => getVideo(slug, timeoutMs),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("/start", () => {
  beforeEach(() => {
    getVideo.mockReset();
  });

  const render = async () => {
    const { default: StartPage } = await import("@/app/start/page");
    return renderToStaticMarkup(await StartPage());
  };

  it("asks the database for the bonus row, not a printed address", async () => {
    getVideo.mockResolvedValue({ state: "pending", slug: "bonus", title: "Bonus Video", reason: "no-row" });
    await render();
    // A short deadline: signing up is this page's job, the video is extra.
    expect(getVideo).toHaveBeenCalledWith("bonus", 1_500);
  });

  it("shows the Bonus Video and holds the card back until the session check", async () => {
    getVideo.mockResolvedValue({
      state: "live",
      slug: "bonus",
      title: "The 700-Point Book 2 Challenge",
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/kJ5uUvPdUEE?rel=0",
    });
    const html = await render();
    expect(html).toContain("<iframe");
    // A signed-in parent must not start typing into a form that then disappears.
    expect(html).not.toContain("Welcome to the Fleet!");
    expect(html).not.toContain("<h2");
  });

  it("shows the form alone while the video is not live", async () => {
    getVideo.mockResolvedValue({ state: "pending", slug: "bonus", title: "Bonus Video", reason: "database-error" });
    const html = await render();
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Welcome to the Fleet!");
  });
});

describe("afterSessionCheck", () => {
  it("keeps the old behaviour without a Bonus Video: signed-in families go to the album", async () => {
    const { afterSessionCheck } = await import("@/app/start/StartForm");
    expect(afterSessionCheck(true, false)).toBe("redirect");
  });

  it("keeps signed-in families on the page to watch the Bonus Video", async () => {
    const { afterSessionCheck } = await import("@/app/start/StartForm");
    expect(afterSessionCheck(true, true)).toBe("welcome-back");
  });

  it("shows the sign-up form to everyone else", async () => {
    const { afterSessionCheck } = await import("@/app/start/StartForm");
    expect(afterSessionCheck(false, true)).toBe("sign-up");
    expect(afterSessionCheck(false, false)).toBe("sign-up");
  });
});
