import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SAMPLE_ENTRIES, badgeImage, pageImage } from "@/lib/neighborhood";

// next/image needs the Next runtime; only the markup it produces matters here.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));

const page = await import("@/app/neighborhood/page");
const html = renderToStaticMarkup(<page.default />);

describe("/neighborhood", () => {
  it("plays both videos on the page, without YouTube's tracking cookie", () => {
    const frames = html.match(/<iframe[^>]*>/g) ?? [];
    expect(frames).toHaveLength(2);
    for (const frame of frames) expect(frame).toContain('src="https://www.youtube-nocookie.com/embed/');
  });

  it("names every video frame for screen readers, and has one main heading", () => {
    for (const frame of html.match(/<iframe[^>]*>/g) ?? []) expect(frame).toMatch(/title="[^"]+"/);
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("shows each sample page with its badge and its Parent's Guide entry", () => {
    for (const entry of SAMPLE_ENTRIES) {
      for (const line of entry.quatrain) expect(html).toContain(line.replace(/'/g, "&#x27;"));
      expect(html).toContain(`data-src="${pageImage(entry)}"`);
      expect(html).toContain(`data-src="${badgeImage(entry)}"`);
      expect(html).toContain(entry.trait);
      expect(html).toContain(entry.scripture.reference);
    }
  });

  it("ends in the request form, which the hero button jumps to", () => {
    expect(html).toContain('href="#request"');
    expect(html).toContain('id="request"');
    expect(html).toMatch(/<form/);
    for (const id of ["sr-name", "sr-role", "sr-school", "sr-location", "sr-email", "sr-phone", "sr-copies", "sr-message"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("stays out of search results and carries its own link preview for the email", () => {
    expect(page.metadata.robots).toEqual({ index: false, follow: false });
    const og = page.metadata.openGraph as { images: { url: string }[] };
    expect(og.images[0].url).toBe("/neighborhood/og.jpg");
  });

  it("promises no price, since the book is not on sale on the site", () => {
    expect(html).not.toMatch(/\$\d/);
  });
});
