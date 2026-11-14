import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Entrances and depth on the parent-facing pages. What matters on the server
 * render: every section is there and visible (no entrance state is sent),
 * a list is still a list, and only things you can click lift on hover.
 */

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const Home = (await import("@/app/page")).default;
const { IllustrationGallery } = await import("@/components/retail/IllustrationGallery");
const WholesaleForm = (await import("@/components/institutions/WholesaleForm")).default;
const { Lightbox } = await import("@/components/ui/Lightbox");
const { book1 } = await import("@/lib/book");

describe("the storefront", () => {
  const html = renderToStaticMarkup(<Home />);

  it("sends every section in full from the server", () => {
    for (const text of ["A look at the pages", "About the book", "About the author", "Peek inside"]) {
      expect(html).toContain(text);
    }
  });

  it("keeps the gallery a list of pages, each one a button that lifts on hover", () => {
    const gallery = renderToStaticMarkup(<IllustrationGallery />);
    const list = /<ul class="[^"]*grid[^"]*">([\s\S]*?)<\/ul>/.exec(gallery);
    expect(list).not.toBeNull();
    const items = list![1].match(/<li>/g) ?? [];
    expect(items).toHaveLength(book1.gallery.length);
    const buttons = list![1].match(/<button[^>]*class="([^"]*)"/g) ?? [];
    expect(buttons).toHaveLength(book1.gallery.length);
    for (const button of buttons) {
      expect(button.split('class="')[1].split(" ")).toContain("lift");
      // The old always-on hover lift is gone; .lift only acts where a pointer hovers.
      expect(button).not.toContain("hover:-translate-y-1");
    }
  });
});

describe("the wholesale tiers", () => {
  it("lift each clickable tier card, and leave the transition to .lift", () => {
    const html = renderToStaticMarkup(<WholesaleForm />);
    const cards = (html.match(/<div class="[^"]*"/g) ?? [])
      .map((tag) => tag.split('"')[1].split(" "))
      .filter((classes) => classes.includes("lift"));
    expect(cards).toHaveLength(3);
    for (const classes of cards) {
      expect(classes).toContain("cursor-pointer");
      expect(classes).not.toContain("transition");
    }
  });
});

describe("the lightbox", () => {
  const images = [
    { src: "/a.svg", alt: "First" },
    { src: "/b.svg", alt: "Second" },
  ];

  it("fades its backdrop in and grows the picture in", () => {
    const html = renderToStaticMarkup(<Lightbox images={images} index={1} onClose={() => {}} onNavigate={() => {}} />);
    expect(html).toMatch(/role="dialog"[^>]*class="[^"]*animate-fade-in/);
    expect(html).toMatch(/<figure class="[^"]*animate-fade-scale/);
  });
});
