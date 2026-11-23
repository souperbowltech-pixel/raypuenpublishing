import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const page = await import("@/app/welcome/page");
describe("welcome video", () => {
  it("identifies the embedding site to YouTube without sending the campaign path or query", () => {
    const html = renderToStaticMarkup(<page.default />);
    const frame = html.match(/<iframe[^>]*>/)?.[0];
    expect(frame).toContain('src="https://www.youtube-nocookie.com/embed/-k_TB3THjQk?');
    expect(frame).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(page.metadata.referrer).toBe("no-referrer");
  });
});
