/**
 * The 19 child-facing virtue pages of Book 1 — the single source of truth for
 * both the interactive dashboard grid (client) and the Master Sticker Sheet PDF
 * (server). Real full-colour merit-badge PNGs drop into public/stickers as
 * slot-01.png … slot-19.png; see `stickerBadgePath` in lib/gamification.
 */
export interface StickerSlotMeta {
  pageNumber: number;
  /** Virtue printed on the illustrator's badge for this page. */
  virtue: string;
  /** Tailwind gradient used for the coloured fallback before the real PNG lands. */
  gradient: string;
}

export const PAGE_STICKER_META: StickerSlotMeta[] = [
  { pageNumber: 1, virtue: "Awareness", gradient: "from-amber-400 to-orange-500" },
  { pageNumber: 2, virtue: "Discernment", gradient: "from-emerald-400 to-teal-600" },
  { pageNumber: 3, virtue: "Alertness", gradient: "from-blue-400 to-indigo-600" },
  { pageNumber: 4, virtue: "Course Correction", gradient: "from-yellow-300 to-amber-500" },
  { pageNumber: 5, virtue: "Humility", gradient: "from-pink-400 to-rose-600" },
  { pageNumber: 6, virtue: "Honesty", gradient: "from-amber-600 to-stone-700" },
  { pageNumber: 7, virtue: "Alignment", gradient: "from-teal-400 to-cyan-600" },
  { pageNumber: 8, virtue: "Deference", gradient: "from-violet-400 to-purple-600" },
  { pageNumber: 9, virtue: "Accountability", gradient: "from-cyan-300 to-blue-500" },
  { pageNumber: 10, virtue: "Resourcefulness", gradient: "from-orange-400 to-red-500" },
  { pageNumber: 11, virtue: "Diligence", gradient: "from-yellow-500 to-amber-700" },
  { pageNumber: 12, virtue: "Patience", gradient: "from-emerald-500 to-green-700" },
  { pageNumber: 13, virtue: "Orderliness", gradient: "from-purple-500 to-indigo-800" },
  { pageNumber: 14, virtue: "Courage", gradient: "from-green-400 to-emerald-600" },
  { pageNumber: 15, virtue: "Fortitude", gradient: "from-rose-400 to-red-600" },
  { pageNumber: 16, virtue: "Adaptability", gradient: "from-sky-400 to-blue-600" },
  { pageNumber: 17, virtue: "Perseverance", gradient: "from-amber-300 to-yellow-600" },
  { pageNumber: 18, virtue: "Integrity", gradient: "from-sky-300 to-indigo-500" },
  { pageNumber: 19, virtue: "Stewardship", gradient: "from-yellow-400 via-orange-500 to-red-500" },
];
