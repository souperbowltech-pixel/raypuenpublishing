import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { SiteHeader } = await import("@/components/retail/SiteHeader");

describe("SiteHeader", () => {
  // The header is shown on /certificate and /guide too. A bare "#buy" there
  // points at a section that only exists on the home page, so Buy Now did nothing.
  it("sends every section link to the home page, so it works from any page", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    expect(html).toContain('href="/#buy"');
    expect(html).toContain('href="/#gallery"');
    expect(html).toContain('href="/#details"');
    expect(html).not.toMatch(/href="#/);
  });
});
