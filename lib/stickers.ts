/**
 * The 19 child-facing virtue pages of Book 1 — the single source of truth for
 * both the interactive dashboard grid (client) and the Master Sticker Sheet PDF
 * (server). Real full-colour merit-badge PNGs drop into public/stickers as
 * slot-01.png … slot-19.png; see `stickerBadgePath` in lib/gamification.
 */
export interface StickerSlotMeta {
  pageNumber: number;
  title: string;
  virtue: string;
  /** Tailwind gradient used for the coloured fallback before the real PNG lands. */
  gradient: string;
}

export const PAGE_STICKER_META: StickerSlotMeta[] = [
  { pageNumber: 1, title: "The Burlap Sack Escape", virtue: "Humility", gradient: "from-amber-400 to-orange-500" },
  { pageNumber: 2, title: "The Hidden Green Mountain", virtue: "Perseverance", gradient: "from-emerald-400 to-teal-600" },
  { pageNumber: 3, title: "Grumble-Grip's Perch", virtue: "Patience", gradient: "from-blue-400 to-indigo-600" },
  { pageNumber: 4, title: "Sunny Fairy's Golden Crown", virtue: "Joy", gradient: "from-yellow-300 to-amber-500" },
  { pageNumber: 5, title: "Pink Bubble-Glue Lake", virtue: "Courage", gradient: "from-pink-400 to-rose-600" },
  { pageNumber: 6, title: "Barnaby Bingle's Crew", virtue: "Teamwork", gradient: "from-amber-600 to-stone-700" },
  { pageNumber: 7, title: "The Wild Blueprint Map", virtue: "Vision", gradient: "from-teal-400 to-cyan-600" },
  { pageNumber: 8, title: "Giant Button Submarine", virtue: "Creativity", gradient: "from-violet-400 to-purple-600" },
  { pageNumber: 9, title: "Whistling Sea-Shell Melody", virtue: "Harmony", gradient: "from-cyan-300 to-blue-500" },
  { pageNumber: 10, title: "Gentle Orange Octopus", virtue: "Kindness", gradient: "from-orange-400 to-red-500" },
  { pageNumber: 11, title: "The Carved Wooden Key", virtue: "Faithfulness", gradient: "from-yellow-500 to-amber-700" },
  { pageNumber: 12, title: "The Sea-Sheller's Secret Den", virtue: "Focus", gradient: "from-emerald-500 to-green-700" },
  { pageNumber: 13, title: "The Throne of Solid Stone", virtue: "Reverence", gradient: "from-purple-500 to-indigo-800" },
  { pageNumber: 14, title: "Tickle-Squid's Lace Mustache", virtue: "Laughter", gradient: "from-green-400 to-emerald-600" },
  { pageNumber: 15, title: "Rolling on the Water", virtue: "Fellowship", gradient: "from-rose-400 to-red-600" },
  { pageNumber: 16, title: "Rare Blue & Tan Paint-Rocks", virtue: "Truth", gradient: "from-sky-400 to-blue-600" },
  { pageNumber: 17, title: "Feathers of Tan & Blue", virtue: "Grace", gradient: "from-amber-300 to-yellow-600" },
  { pageNumber: 18, title: "The Goober's Words Unbound", virtue: "Freedom", gradient: "from-sky-300 to-indigo-500" },
  { pageNumber: 19, title: "The Master Scout Circle", virtue: "Love", gradient: "from-yellow-400 via-orange-500 to-red-500" },
];
