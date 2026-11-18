import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import config from "../tailwind.config";
import { WORLD_LAYER } from "./world";

function luminance(hex: string, multiplier = 1) {
  const channels = hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255 * multiplier);
  return channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}
describe("world assets and contrast", () => {
  it("references only saved local artwork smaller than 800 KB", () => {
    for (const placement of Object.values(WORLD_LAYER.placements)) {
      const asset = path.resolve(__dirname, "../public", placement.src.slice(1));
      expect(fs.statSync(asset).size).toBeLessThan(800000);
    }
  });
  it("keeps small text above AA even if both decorative backgrounds were entirely black", () => {
    const colors = config.theme!.extend!.colors as {paper: {DEFAULT: string; deep: string}; spruce: {DEFAULT: string}; ink: {DEFAULT: string; soft: string}};
    const paper = WORLD_LAYER.placements.paper.opacity;
    const scenery = WORLD_LAYER.placements.gallery.opacity;
    for (const background of [colors.paper.DEFAULT, colors.paper.deep]) {
      for (const foreground of [colors.spruce.DEFAULT, colors.ink.DEFAULT, colors.ink.soft]) {
        const remaining = background === colors.paper.DEFAULT ? (1 - paper) * (1 - scenery) : 1 - paper;
        const ratio = (luminance(background, remaining) + 0.05) / (luminance(foreground) + 0.05);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
