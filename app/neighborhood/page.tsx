import type { Metadata } from "next";
import Image from "next/image";
import { publisherBrand } from "@/lib/book";
import {
  NEIGHBORHOOD_VIDEOS,
  SAMPLE_ENTRIES,
  badgeImage,
  neighborhoodEmbedUrl,
  pageImage,
} from "@/lib/neighborhood";
import { SchoolRequestForm } from "@/components/neighborhood/SchoolRequestForm";
import { BuyBox } from "@/components/retail/BuyBox";
import { isStripeTestMode } from "@/lib/stripe";

const TITLE = "The Neighborhood Chronicles: Sample Kit";
const DESCRIPTION =
  "A Bible-based character curriculum for ages 3 to 7. Watch the videos, see three coloring pages with their badges and Parent's Guide entries, order a copy, or ask about co-op pricing.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Reached from Ray's letter and the table kit, not from search or the site header.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/neighborhood/og.jpg", width: 1200, height: 630, alt: "The Neighborhood Chronicles, Book 1 cover" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/neighborhood/og.jpg"] },
};

/**
 * puenpublishing.com/neighborhood: the sample kit Ray's letter to homeschool
 * leaders points to. Static on purpose: no database read, so the page stays up
 * even when Supabase is paused. Only the order box (Stripe Checkout, the same
 * route as Geezy Goober) and the form at the foot talk to the server.
 */
export default function NeighborhoodPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <section className="grid items-center gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Image
            src="/neighborhood/cover.jpg"
            alt="The Neighborhood Chronicles, Book 1: young David with his shepherd's staff and sling"
            width={900}
            height={1165}
            priority
            sizes="(min-width: 768px) 360px, 80vw"
            className="mx-auto w-4/5 max-w-sm rounded-2xl shadow-book md:w-full"
          />
          <div>
            <p className="eyebrow">Sample kit for homeschool leaders</p>
            <h1 className="mt-2 font-display text-3xl font-black text-ink sm:text-5xl">The Neighborhood Chronicles</h1>
            <p className="mt-2 font-display text-xl font-bold text-clay">Book 1: David and Goliath</p>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              A Bible-based character curriculum for children ages 3 to 7. Sunny, Gideon, Willie, Lucy, Barnabas and
              Gorgon bring the story of David and Goliath into everyday family and playground life, one character trait
              at a time.
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              Each book covers 25 character traits. Every coloring page has a matching sticker badge, a Parent&apos;s
              Guide entry with a parable and a Scripture verse, and four sing-speak videos guide children through the
              story.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#order" className="btn-primary">Order a copy</a>
              <a href="#request" className="btn-secondary">Ask about co-op pricing</a>
            </div>
          </div>
        </section>

        <section aria-labelledby="videos" className="mt-16">
          <h2 id="videos" className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">Watch the videos</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {NEIGHBORHOOD_VIDEOS.map((video) => (
              <figure key={video.youtubeId}>
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-ink shadow-book">
                  <iframe
                    src={neighborhoodEmbedUrl(video)}
                    title={`The Neighborhood Chronicles: ${video.title}`}
                    className="h-full w-full"
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                <figcaption className="mt-3 text-center font-semibold text-ink">{video.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section aria-labelledby="samples" className="mt-16">
          <h2 id="samples" className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
            Three sample pages
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ink-soft">
            Each coloring page, the sticker badge a child earns for finishing it, and the Parent&apos;s Guide entry
            that goes with it.
          </p>

          <div className="mt-10 space-y-14">
            {SAMPLE_ENTRIES.map((entry) => (
              <article
                key={entry.entry}
                aria-labelledby={`entry-${entry.entry}`}
                className="grid gap-8 rounded-3xl border border-ink/10 bg-paper-deep p-5 shadow-card sm:p-8 md:grid-cols-2"
              >
                <Image
                  src={pageImage(entry)}
                  alt={`Coloring page ${entry.entry}: ${entry.trait}`}
                  width={1200}
                  height={1553}
                  sizes="(min-width: 768px) 440px, 90vw"
                  className="w-full rounded-xl border border-ink/10 bg-white"
                />
                <div>
                  <div className="flex items-center gap-4">
                    <Image
                      src={badgeImage(entry)}
                      alt={`Sticker ${entry.entry}: ${entry.badge}`}
                      width={197}
                      height={235}
                      className="h-20 w-auto shrink-0"
                    />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-clay">Entry {entry.entry}</p>
                      <h3 id={`entry-${entry.entry}`} className="font-display text-2xl font-bold text-ink">{entry.trait}</h3>
                      <p className="text-sm text-ink-soft">Sticker {entry.entry}: {entry.badge}</p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm font-bold uppercase tracking-wider text-ink-soft">Parent&apos;s Guide</p>
                  <dl className="mt-2 space-y-3 text-sm leading-relaxed text-ink">
                    <div>
                      <dt className="font-bold">What it means</dt>
                      <dd>{entry.whatItMeans}</dd>
                    </div>
                    <div>
                      <dt className="font-bold">The poem</dt>
                      <dd className="italic">
                        {entry.quatrain.map((line) => (
                          <span key={line} className="block">{line}</span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold">Scripture</dt>
                      <dd>
                        &ldquo;{entry.scripture.text}&rdquo; <span className="whitespace-nowrap">{entry.scripture.reference}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold">The parable</dt>
                      <dd>{entry.parable}</dd>
                    </div>
                    <div>
                      <dt className="font-bold">The catch</dt>
                      <dd>&ldquo;{entry.theCatch}&rdquo;</dd>
                    </div>
                    <div>
                      <dt className="font-bold">Parent connection</dt>
                      <dd>{entry.parentConnection}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="order-heading" className="mt-16 scroll-mt-8">
          <div className="mx-auto max-w-md">
            <h2 id="order-heading" className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
              Order a copy
            </h2>
            <p className="mt-3 text-center text-ink-soft">
              The Neighborhood Chronicles, Book 1: David and Goliath, printed and sent to your home.
            </p>
            <div className="mt-6">
              <BuyBox book="neighborhood-book-1" id="order" testMode={isStripeTestMode()} />
            </div>
          </div>
        </section>

        <section id="request" aria-labelledby="request-heading" className="mt-16 scroll-mt-8">
          <div className="mx-auto max-w-3xl rounded-3xl border-2 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 to-paper p-6 shadow-book sm:p-10">
            <h2 id="request-heading" className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
              Ask about co-op and group pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-ink-soft">
              Tell us a little about your group. Ray Puen reads every request and will reply to you personally.
            </p>
            <div className="mt-8">
              <SchoolRequestForm />
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-ink-soft/80">
          <p>{publisherBrand.fullCredit}</p>
        </footer>
      </div>
    </main>
  );
}
