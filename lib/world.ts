export type WorldEntrance = "peek" | "wiggle" | "rise" | "walk" | "wave";

export interface CharacterPlacement {
  src: `/world/${string}`;
  width: number;
  height: number;
  position: string;
  sizes: string;
  entrance: WorldEntrance;
  eager?: boolean;
}

export interface ScenePlacement {
  src: `/world/${string}`;
  width: number;
  height: number;
  sizes: string;
  opacity: number;
}

/** One switch removes every storefront world decoration. */
export const WORLD_LAYER = {
  enabled: true,
  placements: {
    hero: {
      src: "/world/geezy-peek.png",
      width: 160,
      height: 160,
      position: "-left-14 top-1/3 h-28 w-28 sm:-left-24 sm:h-40 sm:w-40",
      sizes: "(min-width: 640px) 160px, 112px",
      entrance: "peek",
      eager: true,
    } satisfies CharacterPlacement,
    virtues: {
      src: "/world/owl.png",
      width: 80,
      height: 80,
      position: "-top-14 right-1/4 hidden h-20 w-20 sm:block",
      sizes: "80px",
      entrance: "wiggle",
    } satisfies CharacterPlacement,
    gallery: {
      src: "/world/bg-twirl-woods.png",
      width: 1600,
      height: 900,
      sizes: "(min-width: 1152px) 1152px, 100vw",
      opacity: 0.06,
    } satisfies ScenePlacement,
    details: {
      src: "/world/bear.png",
      width: 112,
      height: 112,
      position: "-bottom-14 right-8 hidden h-28 w-28 sm:block",
      sizes: "112px",
      entrance: "rise",
    } satisfies CharacterPlacement,
    author: {
      src: "/world/explorer.png",
      width: 64,
      height: 64,
      position: "bottom-0 right-10 hidden h-16 w-16 sm:block",
      sizes: "64px",
      entrance: "walk",
    } satisfies CharacterPlacement,
    buy: {
      src: "/world/geezy-wave.png",
      width: 64,
      height: 64,
      position: "-right-20 bottom-2 hidden h-16 w-16 sm:block",
      sizes: "64px",
      entrance: "wave",
    } satisfies CharacterPlacement,
    paper: {
      src: "/world/paper-texture.png",
      width: 1024,
      height: 1024,
      sizes: "512px",
      opacity: 0.03,
    } satisfies ScenePlacement,
  },
};
