import { buildEmbedUrl } from "@/lib/videos";

/**
 * The Neighborhood Chronicles sample kit at /neighborhood.
 *
 * Ray's letter to homeschool leaders goes out by email and links here, so this
 * page is the kit: the two videos, three coloring pages with their badges and
 * Parent's Guide entries, and the request form. Everything it shows is written
 * down once, in this file.
 *
 * Pages 3 to 5 (entries 2 to 4) are the sample because page 2 of the
 * 15 Nov interior still carries entry 3's poem. If Sarah's fix arrives, the
 * sample becomes pages 2 to 4 by editing SAMPLE_ENTRIES and the files in
 * public/neighborhood/.
 */

export interface NeighborhoodVideo {
  title: string;
  youtubeId: string;
}

/** Ray's YouTube uploads ("Welcome video (NC)" and "video 1 (NC)"), both embeddable. */
export const NEIGHBORHOOD_VIDEOS: readonly NeighborhoodVideo[] = [
  { title: "Welcome Video", youtubeId: "-k_TB3THjQk" },
  { title: "Video 1", youtubeId: "CwillOje7qY" },
];

export function neighborhoodEmbedUrl(video: NeighborhoodVideo): string {
  const url = buildEmbedUrl("youtube", video.youtubeId);
  if (!url) throw new Error(`Invalid YouTube id for ${video.title}`);
  return url;
}

export interface SampleEntry {
  /** Entry and sticker number in the book and the Guide. */
  entry: number;
  /** Page of the printed interior the coloring page comes from. */
  page: number;
  trait: string;
  whatItMeans: string;
  badge: string;
  quatrain: readonly [string, string, string, string];
  scripture: { text: string; reference: string };
  parable: string;
  theCatch: string;
  parentConnection: string;
}

/** Entries 2 to 4 of the Parent's Guide (13 Nov), word for word, without the illustrator's notes. */
export const SAMPLE_ENTRIES: readonly SampleEntry[] = [
  {
    entry: 2,
    page: 3,
    trait: "Purpose",
    whatItMeans: "Knowing that God has a special, beautiful plan just for your life that only you can complete.",
    badge: "Oil Flask Badge",
    quatrain: [
      "A shepherd boy of Jesse’s line,",
      "Is chosen for a grand design.",
      "The prophet pours the oil in peace,",
      "To promise rules that never cease.",
    ],
    scripture: {
      text: "Then Samuel took the horn of oil and anointed him in the midst of his brothers...",
      reference: "1 Samuel 16:13a (NKJV)",
    },
    parable:
      "Leo found a plain, dusty, forgotten key sitting on a high shelf in the garage. It looked like an ordinary piece of old metal, but when his dad tried it in the lock of a heavy vintage trunk, it opened a box full of cherished family treasures.",
    theCatch:
      "If Leo had thrown that plain key into the trash because it looked old and dusty, the family treasures would have stayed locked away forever. What special plan do you think God is unlocking inside of you?",
    parentConnection:
      "Just like that dusty garage key unlocked a chest of treasures, God chose a humble shepherd boy named David for a royal purpose that would last forever. You never have to be famous or grown-up for God to have an amazing plan for your life! Look closely at the cascading droplets of olive oil pouring from Samuel’s horn. Can you find the hidden sunburst ray sparkling in the oil? Let’s pray tonight and ask God to guide our steps into His wonderful purpose.",
  },
  {
    entry: 3,
    page: 4,
    trait: "Fairness",
    whatItMeans: "Giving everyone an equal chance to show their heart instead of judging by how they look on the outside.",
    badge: "Beautiful Heart Badge",
    quatrain: [
      "While older brothers stood in line,",
      "Young David watched the sheep recline.",
      "He fought a bear, he played his lyre,",
      "For God reads hearts and grants desire.",
    ],
    scripture: {
      text: "But the Lord said to Samuel, ‘Do not look at his appearance or at his physical stature...’",
      reference: "1 Samuel 16:7a (NKJV)",
    },
    parable:
      "Thinking back to Hannah at the fruit stand, she realized that every apple tree grows fruit in different shapes and sizes. Even though the biggest, tallest apples caught everyone's eye first, the smaller ones growing quietly on the lower branches were just as healthy and sweet.",
    theCatch:
      "If we pick friends or leaders based only on who is the tallest, loudest, or strongest, we miss out on wonderful people. How can you practice looking past the outside show today?",
    parentConnection:
      "Samuel saw David's seven tall, strong brothers standing in shiny armor, yet God reminded him not to judge by outward size or stature. Fairness means giving everyone a chance and looking for goodness on the inside rather than judging by outside looks! Look closely at the rolling contours of the green meadow hills behind David. Can you trace where they shape a hidden sunburst ray? Let's ask God tonight to give us eyes that look for goodness on the inside.",
  },
  {
    entry: 4,
    page: 5,
    trait: "Sincerity",
    whatItMeans: "Doing things with a loving heart, even when nobody else can see what you are doing.",
    badge: "Golden Harp Badge",
    quatrain: [
      "A man will judge by what he sees,",
      "But God looks where the heart agrees.",
      "He bypasses the outer show,",
      "To let the inner goodness grow.",
    ],
    scripture: {
      text: "...for man looks at the outward appearance, but the Lord looks at the heart.",
      reference: "1 Samuel 16:7c (NKJV)",
    },
    parable:
      "Little Tobi spent all afternoon drawing a picture for his mom. The crayon lines went outside the edges and the colors were a little messy, so Tobi worried it wasn't good enough, until his mom smiled, hugged him, and hung it right in the center of the fridge.",
    theCatch:
      "If Tobi's mom had only cared about neat, straight lines, she would have missed all the love Tobi put into every scribble. Why does God care so much more about our love than about looking perfect?",
    parentConnection:
      "Tobi's picture wasn't a museum masterpiece, yet his mom treasured it because it was made with a sincere, loving heart. God bypasses outward perfection and delights in every quiet act of love we offer Him! Look closely at the soft background lighting lines behind Samuel’s empty horn. Can you spot the hidden sunburst ray shining there? Let’s thank God tonight that He sees and loves every sincere effort of our hearts.",
  },
];

export const pageImage = (entry: SampleEntry) => `/neighborhood/page-${entry.page}.jpg`;
export const badgeImage = (entry: SampleEntry) => `/neighborhood/badge-${entry.entry}.png`;
