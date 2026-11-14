/**
 * GSAP arrives in its own chunk, fetched only when an entrance is about to
 * play, so pages that never animate never download it. One place for the
 * import also gives tests a single seam to replace.
 */
export const loadGsap = () => import("gsap");
