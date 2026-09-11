/**
 * ============================================================================
 *  BOOK & SITE CONTENT — Official Copy
 * ============================================================================
 *
 *  All copy and imagery for Book 1 lives here so it can be edited in one place.
 * ============================================================================
 */

export interface GalleryImage {
  /** Path under /public. */
  src: string;
  /** Alt text (also shown as the caption in the lightbox). */
  alt: string;
}

export interface BookContent {
  sku: string;
  title: string;
  tagline: string;
  description: string;
  ageRange: string;
  pageCount: number;
  dimensions: string;
  coverImage: GalleryImage;
  gallery: GalleryImage[];
}

export const book1: BookContent = {
  sku: "PUEN-CB-001",
  title: "The Geezy Goober's Guide to Icky Sfand",
  tagline:
    "An Interactive Rhythmic Rhyme & Tactile Coloring Quest for Early Learners.",
  description:
    "Deep in the woods of Twist-and-Twirl, words are mysteriously vanishing! Co-created by Publisher Ray Puen and his young granddaughters, Kira Grace and Cayleigh Joy, this interactive adventure features a precise, musical iambic rhythm that grips a child's focus. Designed as a deliberate two-part strategy, Volume 1 captures children's deep affection through high-appeal whimsical adventure coloring blocks, priming their hearts to follow our storybook heroes into future structural paths of honor, kindness, and respect.",
  ageRange: "Ages 3–7",
  pageCount: 32,
  dimensions: '8.5" × 8.5" (square, softcover)',
  coverImage: {
    src: "/placeholders/cover.svg",
    alt: "Front cover of The Geezy Goober's Guide to Icky Sfand",
  },
  gallery: [
    {
      src: "/placeholders/interior-1.svg",
      alt: "Interior page 1 — meadow scene",
    },
    {
      src: "/placeholders/interior-2.svg",
      alt: "Interior page 2 — friendly fox",
    },
    {
      src: "/placeholders/interior-3.svg",
      alt: "Interior page 3 — under the sea",
    },
    {
      src: "/placeholders/interior-4.svg",
      alt: "Interior page 4 — hot air balloon",
    },
  ],
};

/** About-the-author trust block. */
export const author = {
  name: "Ray Puen, Publisher",
  photo: {
    src: "/placeholders/author.svg",
    alt: "Portrait of Ray Puen, Publisher",
  },
  bio:
    "Puen Publishing is an independent literary house unshakably anchored in the scriptural truth of 2 Timothy 3:16—that all scripture is profitable for instruction in righteousness. Forged through real-world early childhood education on the mission fields of the Philippines, Thailand, and Nepal, our unique gamified curriculum templates capture children's focus and transform behavior, helping early learners discover their true identity and noble character potential.",
};

/** Shipping & returns copy. */
export const shippingReturns = {
  shipping:
    "Orders ship within 2–3 business days directly from our printing and distribution facility.",
  returns:
    "Unopened books can be returned within 30 days for a full refund.",
};

export const siteMeta = {
  name: "Puen Publishing",
  shortName: "Puen",
  description:
    "The Geezy Goober's Guide to Icky Sfand — An Interactive Rhythmic Rhyme & Tactile Coloring Quest for Early Learners.",
};
