import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { WorldCharacter } from "./WorldCharacter";
import { WORLD_LAYER, type CharacterPlacement, type WorldEntrance } from "@/lib/world";

const placement = (entrance: WorldEntrance): CharacterPlacement => ({ ...WORLD_LAYER.placements.hero, eager: entrance === "peek", entrance });
afterEach(() => { WORLD_LAYER.enabled = true; });

describe("WorldCharacter server markup", () => {
  it.each(["peek", "wiggle", "rise", "walk", "wave"] as const)("sends a visible, inert %s image before JavaScript", entrance => {
    const html = renderToStaticMarkup(<WorldCharacter placement={placement(entrance)} />);
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('width="160" height="160"');
    expect(html).toContain(`loading="${entrance === "peek" ? "eager" : "lazy"}"`);
    expect(html).toContain("pointer-events-none absolute");
    expect(html).not.toMatch(/tabindex|<button|<a\s|opacity:0|visibility:hidden|scale\(0\)/);
  });
  it("omits missing placements and the entire disabled layer", () => {
    expect(renderToStaticMarkup(<WorldCharacter />)).toBe("");
    WORLD_LAYER.enabled = false;
    expect(renderToStaticMarkup(<WorldCharacter placement={placement("peek")} />)).toBe("");
  });
});
