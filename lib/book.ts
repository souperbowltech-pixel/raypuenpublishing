/**
 * ============================================================================
 *  BOOK & SITE CONTENT — Official Copy & Brand Configuration
 * ============================================================================
 */

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface BookEdition {
  editionId: "standard" | "payItForward" | "nepalRecovery";
  name: string;
  frontCoverSeal?: string;
  backCoverCallout?: string;
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
  activeEdition: BookEdition;
}

export const book1: BookContent = {
  sku: "PUEN-CB-001",
  title: "The Geezy Goober's Guide to Icky Sfand",
  tagline: "The Geezy Goober and the Magic Pen",
  description:
    "Deep in the woods of Twist-and-Twirl, words are mysteriously vanishing! Co-created by Publisher Ray Puen and his young granddaughters, Kira Grace and Cayleigh Joy, this interactive adventure features a precise, musical iambic rhythm that grips a child's focus. Designed as a deliberate two-part strategy, Volume 1 captures children's deep affection through high-appeal whimsical adventure coloring blocks, priming their hearts to follow our storybook heroes into future structural paths of honor, kindness, and respect.",
  ageRange: "Ages 3–7",
  pageCount: 32,
  dimensions: '8.5" × 8.5" (square, softcover)',
  coverImage: {
    src: "/placeholders/cover.svg",
    alt: "Front cover of The Geezy Goober's Guide to Icky Sfand",
  },
  activeEdition: {
    editionId: "nepalRecovery",
    name: "Nepal Recovery Initiative Edition",
    frontCoverSeal: "100% of Proceeds Dedicated to Nepal Flood Recovery",
    backCoverCallout: "Pay It Forward: Sponsor a homeschool circle at puenpublishing.com/institutions",
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

/** Official Publisher Registry & Imprint Details */
export const publisherBrand = {
  umbrellaName: "Regency Press",
  imprintName: "Puen Publishing",
  fullCredit: "Published by Regency Press under the Puen Publishing Imprint",
  colophonLogo: "/brand/puen-colophon.png",
  mottoImage: "/brand/puen-motto.png",
  slogan: "Building character is our commitment; your child's destiny is our product.",
  imprint: {
    company: "Regency Press • Puen Publishing",
    website: "www.puenpublishing.com",
    email: "info@puenpublishing.com",
    cityState: "Loma Linda, California · USA",
  },
};

/** About-the-author trust block. */
export const author = {
  name: "Ray Puen, Publisher",
  photo: {
    src: "/placeholders/author.svg",
    alt: "Portrait of Ray Puen, Publisher",
  },
  bio:
    "Published under the Regency Press umbrella with the Puen Publishing educational imprint, this literary work is unshakably anchored in the scriptural truth of 2 Timothy 3:16—that all scripture is profitable for instruction in righteousness. Forged through real-world early childhood education on the mission fields of the Philippines, Thailand, and Nepal, our unique gamified curriculum templates capture children's focus and transform behavior, helping early learners discover their true identity and noble character potential.",
};

/** Shipping & returns copy. */
export const shippingReturns = {
  shipping:
    "Orders ship within 2–3 business days directly from our printing and distribution facility.",
  returns:
    "Unopened books can be returned within 30 days for a full refund.",
};

export const siteMeta = {
  name: "Regency Press • Puen Publishing",
  shortName: "Regency Press",
  description:
    "The Geezy Goober's Guide to Icky Sfand: The Geezy Goober and the Magic Pen — Published by Regency Press under the Puen Publishing Imprint.",
};
