import { describe, it, expect } from "vitest";
import {
  VIDEO_SLUGS,
  isVideoSlug,
  buildEmbedUrl,
  resolveVideo,
  isMissingTableError,
  type VideoRow,
} from "@/lib/videos";

/**
 * These addresses are printed on paper. The two behaviours that must never
 * regress are therefore:
 *  1. nothing resolves to an error or a 404 — every bad input becomes "pending";
 *  2. nothing but a validated id from a known host ever reaches an iframe src.
 */

const live = (over: Partial<VideoRow> = {}): VideoRow => ({
  slug: "v1",
  title: "Meet Geezy Goober",
  provider: "youtube",
  video_id: "dQw4w9WgXcQ",
  status: "live",
  ...over,
});

describe("VIDEO_SLUGS", () => {
  it("is exactly the five addresses that go in the book", () => {
    expect(VIDEO_SLUGS).toEqual(["v1", "v2", "v3", "v4", "v5"]);
  });
});

describe("isVideoSlug", () => {
  it("accepts each printed slug", () => {
    for (const slug of VIDEO_SLUGS) expect(isVideoSlug(slug)).toBe(true);
  });

  it.each(["v0", "v6", "V1", "v1 ", " v1", "", "v1/../admin", "v1?x=1", "1", "videos"])(
    "rejects %j",
    (value) => {
      expect(isVideoSlug(value)).toBe(false);
    }
  );

  it("rejects non-strings", () => {
    for (const value of [null, undefined, 1, {}, ["v1"]]) expect(isVideoSlug(value)).toBe(false);
  });
});

describe("buildEmbedUrl", () => {
  it("embeds YouTube through youtube-nocookie and never as a watch link", () => {
    const url = buildEmbedUrl("youtube", "dQw4w9WgXcQ");
    expect(url).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1"
    );
    expect(url).not.toContain("watch?v=");
    expect(url).not.toContain("//www.youtube.com");
  });

  it("builds a Cloudflare Stream iframe from a 32-character uid", () => {
    expect(buildEmbedUrl("cloudflare", "a1b2c3d4e5f60718293a4b5c6d7e8f90")).toBe(
      "https://iframe.videodelivery.net/a1b2c3d4e5f60718293a4b5c6d7e8f90"
    );
  });

  it("builds a Bunny Stream iframe from libraryId/videoGuid", () => {
    expect(buildEmbedUrl("bunny", "12345/9f8e7d6c-1234-4abc-9def-0123456789ab")).toBe(
      "https://iframe.mediadelivery.net/embed/12345/9f8e7d6c-1234-4abc-9def-0123456789ab"
    );
  });

  it("builds a Vimeo player url with tracking declined", () => {
    expect(buildEmbedUrl("vimeo", "123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
  });

  it("trims whitespace pasted around an id", () => {
    expect(buildEmbedUrl("youtube", "  dQw4w9WgXcQ  ")).toContain("/embed/dQw4w9WgXcQ?");
  });

  it("returns null when there is no provider or the provider is unknown", () => {
    expect(buildEmbedUrl("none", "dQw4w9WgXcQ")).toBeNull();
    expect(buildEmbedUrl("", "dQw4w9WgXcQ")).toBeNull();
    expect(buildEmbedUrl(null, "dQw4w9WgXcQ")).toBeNull();
    expect(buildEmbedUrl("tiktok", "dQw4w9WgXcQ")).toBeNull();
    expect(buildEmbedUrl("YouTube", "dQw4w9WgXcQ")).toBeNull();
  });

  it("returns null for a missing or empty id", () => {
    expect(buildEmbedUrl("youtube", null)).toBeNull();
    expect(buildEmbedUrl("youtube", "")).toBeNull();
    expect(buildEmbedUrl("youtube", "   ")).toBeNull();
  });

  // The table is edited by hand, so anything that is not the host's own id
  // format must fail closed rather than reach an iframe src.
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    'dQw4w9WgXcQ" onload="alert(1)',
    "dQw4w9WgXcQ?end=1",
    "dQw4w9WgXcQ&autoplay=1",
    "javascript:alert(1)",
    "../../admin",
    "abc", // too short to be a real id
  ])("rejects the unsafe or malformed YouTube id %j", (id) => {
    expect(buildEmbedUrl("youtube", id)).toBeNull();
  });

  it("rejects ids in the wrong format for their host", () => {
    expect(buildEmbedUrl("cloudflare", "A1B2C3D4E5F60718293A4B5C6D7E8F90")).toBeNull(); // uppercase
    expect(buildEmbedUrl("cloudflare", "a1b2c3")).toBeNull(); // too short
    expect(buildEmbedUrl("vimeo", "not-a-number")).toBeNull();
    expect(buildEmbedUrl("vimeo", "12345")).toBeNull(); // too short
    expect(buildEmbedUrl("bunny", "9f8e7d6c-1234-4abc-9def-0123456789ab")).toBeNull(); // no library id
  });
});

describe("resolveVideo", () => {
  it("plays the video when the row is live and complete", () => {
    expect(resolveVideo("v1", live())).toEqual({
      state: "live",
      slug: "v1",
      title: "Meet Geezy Goober",
      provider: "youtube",
      embedUrl:
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1",
    });
  });

  it("waits, with a default title, when the row does not exist yet", () => {
    expect(resolveVideo("v3", null)).toEqual({
      state: "pending",
      slug: "v3",
      title: "Video 3",
      reason: "no-row",
    });
    expect(resolveVideo("v3", undefined)).toMatchObject({ state: "pending", reason: "no-row" });
  });

  it("waits while the row is still pending, but keeps the real title", () => {
    expect(resolveVideo("v2", live({ status: "pending", title: "The Magic Pen Song" }))).toEqual({
      state: "pending",
      slug: "v2",
      title: "The Magic Pen Song",
      reason: "not-live",
    });
  });

  it("waits on any status that is not exactly 'live'", () => {
    for (const status of ["LIVE", "Live", "ready", "", null, undefined]) {
      expect(resolveVideo("v1", live({ status }))).toMatchObject({ state: "pending" });
    }
  });

  it("waits when a row was flipped to live before the video id was filled in", () => {
    expect(resolveVideo("v1", live({ video_id: null }))).toMatchObject({
      state: "pending",
      reason: "no-video-id",
    });
    expect(resolveVideo("v1", live({ video_id: "  " }))).toMatchObject({
      state: "pending",
      reason: "no-video-id",
    });
    expect(resolveVideo("v1", live({ provider: "none" }))).toMatchObject({
      state: "pending",
      reason: "no-video-id",
    });
  });

  it("waits, rather than breaking, on a provider this build cannot embed", () => {
    expect(resolveVideo("v1", live({ provider: "dailymotion" }))).toMatchObject({
      state: "pending",
      reason: "unknown-provider",
    });
  });

  it("waits when the id is malformed for its provider", () => {
    expect(resolveVideo("v1", live({ video_id: "https://youtu.be/dQw4w9WgXcQ" }))).toMatchObject({
      state: "pending",
      reason: "bad-video-id",
    });
  });

  it("falls back to the default title when the row's title is blank", () => {
    expect(resolveVideo("v5", live({ status: "pending", title: "   " })).title).toBe("Video 5");
    expect(resolveVideo("v4", live({ status: "pending", title: null })).title).toBe("Video 4");
  });

  it("never returns anything but a live or pending state", () => {
    const rows: (VideoRow | null)[] = [
      null,
      {},
      live(),
      live({ status: "pending" }),
      live({ provider: "nonsense" }),
      live({ video_id: "<script>" }),
      { slug: "v1", title: null, provider: null, video_id: null, status: null },
    ];
    for (const row of rows) {
      expect(["live", "pending"]).toContain(resolveVideo("v1", row).state);
    }
  });
});

describe("isMissingTableError", () => {
  it("recognises the Postgres and PostgREST forms of a missing table", () => {
    expect(isMissingTableError({ code: "42P01", message: 'relation "videos" does not exist' })).toBe(true);
    expect(
      isMissingTableError({
        code: "PGRST205",
        message: "Could not find the table 'public.videos' in the schema cache",
      })
    ).toBe(true);
    expect(isMissingTableError({ code: null, message: "Could not find the table in the schema cache" })).toBe(
      true
    );
  });

  it("does not mistake other failures for a missing table", () => {
    expect(isMissingTableError({ code: "42501", message: "permission denied for table videos" })).toBe(false);
    expect(isMissingTableError({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isMissingTableError({ code: undefined, message: undefined })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });
});
