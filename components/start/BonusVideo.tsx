import type { VideoView } from "@/lib/videos";

/**
 * Sunny's Bonus Video at the top of /start, the page behind the last code in the
 * book. Unlike the printed /v pages it shows nothing until the row is live: the
 * Start page has its own job, so a "coming soon" card would only push the form down.
 */
export function BonusVideo({ view }: { view: VideoView }) {
  if (view.state !== "live") return null;
  return (
    <section className="mb-8" aria-labelledby="bonus-video-title">
      {/* Not a heading: the page's h1 sits below, in the sign-up card. */}
      <p id="bonus-video-title" className="text-center font-display text-2xl font-black text-ink">
        {view.title}
      </p>
      <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl bg-ink shadow-book">
        <iframe
          src={view.embedUrl}
          title={view.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </section>
  );
}
