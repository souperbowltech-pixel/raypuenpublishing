import Link from "next/link";
import { SiteHeader } from "@/components/retail/SiteHeader";
import { SiteFooter } from "@/components/retail/SiteFooter";
import { NC_PORTALS, ncPortalEmbed, ncPortalPath, type NcPortal } from "@/lib/nc-portals";

export function NcPortalPage({ portal }: { portal: NcPortal }) {
  const embed = ncPortalEmbed(portal);
  return <><SiteHeader /><main className="min-h-screen bg-paper px-4 py-10 sm:py-16">
    <div className="mx-auto max-w-3xl">
      <p className="font-semibold text-clay">The Neighborhood Chronicles, Book 1: David and Goliath</p>
      <h1 className="mt-3 break-words font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{portal.title}</h1>
      {embed ? <>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">Watch together with your child, then return to your coloring book for the next part of the adventure.</p>
        <div className="mt-6 aspect-video min-h-[200px] w-full overflow-hidden rounded-2xl bg-ink shadow-book">
          <iframe src={embed} title={`${portal.label}: ${portal.title}`} className="h-full min-h-[200px] w-full"
            allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
        <p className="mt-4 text-base text-ink-soft">Having trouble with the player? <a href={`https://www.youtube.com/watch?v=${portal.youtubeId}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Open this video on YouTube</a>.</p>
      </> : portal.kind === "invite" ? <div className="mt-6 rounded-2xl border border-ink/15 bg-white p-6 sm:p-8">
        <p className="text-lg leading-relaxed text-ink-soft">Adventures are more fun with friends. As a parent or adult caregiver, invite two families to meet Sunny and the Neighborhood friends.</p>
        <p className="mt-4 text-base text-ink-soft">Share this address with them:</p>
        <a href="/nc/welcome" className="mt-2 inline-flex min-h-11 items-center break-all text-lg font-semibold text-clay underline underline-offset-4">puenpublishing.com/nc/welcome</a>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">Watch the Welcome Video together, then explore the free coloring activities below.</p>
      </div> : <div className="mt-6 rounded-2xl border border-ink/15 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold text-ink">Start your family&apos;s Neighborhood adventure</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">Parents and adult caregivers can meet the characters and request the free six-page Starter Kit.</p>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">Club registration and referral rewards are not open yet. Requesting the kit does not create a club account or unlock a free book.</p>
      </div>}
      <section className="mt-8 rounded-2xl border border-ink/15 bg-white p-6 sm:p-8" aria-labelledby="nc-kit-title">
        <h2 id="nc-kit-title" className="font-display text-2xl font-bold text-ink">Try an activity together</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">Choose a character and request three coloring pages with three matching Parent&apos;s Guide pages and badges.</p>
        <Link href="/welcome#vote" className="btn-primary mt-5 inline-flex min-h-12">Request the Free Starter Kit</Link>
        <Link href="/neighborhood" className="mt-4 flex min-h-11 items-center text-ink-soft underline underline-offset-4">Browse the book and sample activities</Link>
      </section>
      <nav aria-label="Neighborhood book pages" className="mt-8 border-t border-ink/15 pt-6">
        <h2 className="font-semibold text-ink">More from your book</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">{NC_PORTALS.filter((other) => other.slug !== portal.slug).map((other) =>
          <li key={other.slug}><Link href={ncPortalPath(other)} className="inline-flex min-h-11 items-center text-base text-ink-soft underline underline-offset-4">{other.label}</Link></li>)}</ul>
      </nav>
    </div>
  </main><SiteFooter /></>;
}
