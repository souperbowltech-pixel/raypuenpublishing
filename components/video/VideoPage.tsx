import Link from "next/link";
import { publisherBrand } from "@/lib/book";
import { getVideo, type VideoSlug } from "@/lib/videos";

/**
 * One of the five video pages printed inside the colouring book
 * (`puenpublishing.com/v1` ... `/v5`).
 *
 * Two states, decided by the row in `public.videos`:
 *  - live    — the video plays here, embedded, so the child stays on our page;
 *  - pending — a friendly "on its way" screen.
 *
 * There is no third state on purpose. Every failure resolves to `pending` in
 * `lib/videos.ts`, because the address is printed on paper and a child who scans
 * it must never meet a 404 or an error.
 */
export async function VideoPage({ slug }: { slug: VideoSlug }) {
  const view = await getVideo(slug);
  const printedAddress = `puenpublishing.com/${slug}`;

  return (
    <main className="min-h-screen bg-paper px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow text-center">The Geezy Goober Explorer Fleet</p>

        {view.state === "live" ? (
          <>
            <h1 className="mt-2 text-center font-display text-2xl font-black text-ink sm:text-3xl">
              {view.title}
            </h1>
            <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-ink shadow-book">
              <iframe
                src={view.embedUrl}
                title={view.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <p className="mt-5 text-center text-ink-soft">
              Colouring along? Your child&apos;s sticker album, quiz and rewards live on this site too.
            </p>
          </>
        ) : (
          <div className="mt-2 rounded-3xl border-2 border-crayon-gold bg-gradient-to-b from-crayon-goldsoft/40 to-paper p-6 shadow-book sm:p-10">
            <h1 className="text-center font-display text-3xl font-black text-ink sm:text-4xl">
              This video is on its way!
            </h1>
            <p className="mt-4 text-center text-lg text-ink-soft">
              Your book arrived before the film crew finished. <strong className="text-ink">{view.title}</strong>{" "}
              will play right here as soon as it is ready.
            </p>
            <p className="mt-3 text-center text-ink-soft">
              Nothing to do — this is the right page. Scan the code in your book again in a few days,
              or type{" "}
              <span className="whitespace-nowrap font-semibold text-ink">{printedAddress}</span>{" "}
              into any browser.
            </p>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-ink/10 bg-paper-deep p-6 text-center">
          <h2 className="font-display text-xl font-bold text-ink">
            While you wait, start the sticker album
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Set your Chief Explorer up in under a minute: a sticker for every page coloured, the
            quiz, and the road to a free Volume 2.
          </p>
          <Link href="/start" className="btn-primary mt-5">
            Start your sticker album
          </Link>
        </div>

        <footer className="mt-10 text-center text-xs text-ink-soft/80">
          <p>{publisherBrand.fullCredit}</p>
        </footer>
      </div>
    </main>
  );
}
