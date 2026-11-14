/**
 * GSAP arrives in its own chunk, fetched only when an entrance is about to
 * play, so pages that never animate never download it. One place for the
 * imports also gives tests a single seam to replace.
 */
export const loadGsap = () => import("gsap");

/** GSAP with ScrollTrigger registered, for motion tied to the scroll position. */
export const loadScrollGsap = async () => {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
};
