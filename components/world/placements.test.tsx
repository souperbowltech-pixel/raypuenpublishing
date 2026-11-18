import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/retail/Hero";
import { VirtueMarquee, BOOK1_VIRTUE_BADGES } from "@/components/motion/VirtueMarquee";
import { IllustrationGallery } from "@/components/retail/IllustrationGallery";
import { WorldScene } from "./WorldScene";
import { WORLD_LAYER } from "@/lib/world";
import { BookDetails } from "@/components/retail/BookDetails";
import { AboutAuthor } from "@/components/retail/AboutAuthor";
import { BuyBox } from "@/components/retail/BuyBox";
import RetailLandingPage from "@/app/page";
import { WorldPaper } from "./WorldPaper";

describe("storefront world placements", () => {
  it("keeps the hero character behind the cover and smaller than it", () => {
    const html = renderToStaticMarkup(<Hero />);
    expect(html).toContain('data-world-character="peek"');
    expect(html.indexOf('data-world-character="peek"')).toBeLessThan(html.indexOf('alt="Front cover'));
    expect(html).toContain('sm:w-80');
    expect(html).toContain('sm:w-40');
  });
  it("adds the owl only to the storefront strip, leaving its controls and list intact", () => {
    const plain = renderToStaticMarkup(<VirtueMarquee badges={BOOK1_VIRTUE_BADGES} />);
    const world = renderToStaticMarkup(<VirtueMarquee badges={BOOK1_VIRTUE_BADGES} world />);
    expect(plain).not.toContain('data-world-character');
    expect(world).toContain('data-world-character="wiggle"');
    expect(world).toContain('loading="lazy"');
    expect(world.match(/<ul/g)).toHaveLength(1);
    expect(world).toContain('aria-label="Virtues in Book 1"');
  });
  it("puts a clipped, lazy decorative woods scene behind the gallery without moving its content", () => {
    const html = renderToStaticMarkup(<IllustrationGallery />);
    expect(html).toContain('container-page relative isolate py-16');
    expect(html).toContain('data-world-scene=""');
    expect(html).toContain('pointer-events-none absolute inset-0 -z-10');
    expect(html).toContain('opacity:0.06');
    expect(html).toContain('width="1600" height="900"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<WorldScene />)).toBe("");
    WORLD_LAYER.enabled = false;
    try { expect(renderToStaticMarkup(<WorldScene placement={WORLD_LAYER.placements.gallery} />)).toBe(""); }
    finally { WORLD_LAYER.enabled = true; }
  });
  it("clips the bear at the bottom edge outside the details grid", () => {
    const html = renderToStaticMarkup(<BookDetails />);
    expect(html).toContain('relative isolate overflow-hidden bg-paper-deep py-16');
    expect(html).toContain('data-world-character="rise"');
    expect(html).toContain('-bottom-14 right-8 hidden h-28 w-28 sm:block');
    expect(html.indexOf('</dl>')).toBeLessThan(html.indexOf('data-world-character="rise"'));
  });
  it("places the explorer in the author section's bottom padding", () => {
    const html = renderToStaticMarkup(<AboutAuthor />);
    expect(html).toContain('container-page relative isolate py-16');
    expect(html).toContain('data-world-character="walk"');
    expect(html).toContain('bottom-0 right-10 hidden h-16 w-16 sm:block');
    expect(html).toContain('loading="lazy"');
  });
  it("keeps the waving Geezy outside the purchase card and anchors its trigger to the card", () => {
    const html = renderToStaticMarkup(<BuyBox testMode />);
    expect(html).toContain('id="buy" data-world-trigger=""');
    expect(html).toContain('data-world-character="wave"');
    expect(html).toContain('-right-20 bottom-2 hidden h-16 w-16 sm:block');
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Increase quantity"');
  });
  it("never puts the waving Geezy on another book's buy box", () => {
    const html = renderToStaticMarkup(<BuyBox book="neighborhood-book-1" id="order" testMode />);
    expect(html).not.toContain('data-world-character="wave"');
    expect(html).not.toContain("data-world-trigger");
  });
  it("ships a static repeating paper fallback without JavaScript and lazy loading with it", () => {
    const html = renderToStaticMarkup(<WorldPaper />);
    expect(html).toContain('data-world-paper=""');
    expect(html).toContain('background-repeat:repeat;background-size:512px 512px');
    expect(html).toContain('opacity:0.03');
    expect(html).toContain('<noscript>');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt=""');
  });
  it("removes the entire layer through one switch and leaves the future assets unused", () => {
    const html = renderToStaticMarkup(<RetailLandingPage />);
    expect(html.match(/data-world-character=/g)).toHaveLength(5);
    expect(html.match(/data-world-paper=/g)).toHaveLength(4);
    expect(html).not.toMatch(/bg-hill-path|bg-lantern-night|sunny-fairy|david\.png/);
    WORLD_LAYER.enabled = false;
    try {
      const plain = renderToStaticMarkup(<RetailLandingPage />);
      expect(plain).not.toMatch(/data-world-|%2Fworld%2F|\/world\//);
      expect(plain).toContain('id="buy"');
      expect(plain).toContain('A look at the pages');
    } finally { WORLD_LAYER.enabled = true; }
  });
});
