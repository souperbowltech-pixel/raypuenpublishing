import type { Metadata } from "next";
import Image from "next/image";
import { VoteForm } from "@/components/campaign/VoteForm";
import { SiteHeader } from "@/components/retail/SiteHeader";
import { SiteFooter } from "@/components/retail/SiteFooter";
import { NEIGHBORHOOD_VIDEOS, neighborhoodEmbedUrl } from "@/lib/neighborhood";

export const metadata: Metadata = {
  title: "Meet the Neighborhood Friends | Free Starter Kit | Puen Publishing",
  description: "Watch the Welcome Video together, choose a neighborhood friend and try free coloring activities with your child.",
  referrer: "no-referrer", openGraph: { images: ["/neighborhood/og.jpg"] },
};
export default function WelcomePage() {
  return <><SiteHeader /><main className="bg-paper px-4 py-10 sm:py-16">
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start gap-5"><Image src="/neighborhood/cover.jpg" alt="The Neighborhood Chronicles, Book 1: David and Goliath" width={110} height={143} className="hidden rounded-lg shadow-card sm:block" />
        <div><p className="font-semibold text-clay">The Neighborhood Chronicles, for ages 3 to 7</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">Watch Sunny&apos;s Welcome Video with your child, then vote for your free Character Starter Kit.</h1>
          <p className="mt-4 text-lg text-ink-soft">Meet the friends, choose a teammate and enjoy a Bible-based coloring activity together. The video is free to watch.</p></div>
      </div>
      <div className="mb-8 aspect-video overflow-hidden rounded-2xl bg-ink"><iframe src={neighborhoodEmbedUrl(NEIGHBORHOOD_VIDEOS[0])} title="The Neighborhood Chronicles Welcome Video" className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
      <p className="mb-6 text-base text-ink-soft">Video not playing? You can still choose a character and request the kit below.</p>
      <VoteForm />
    </div>
  </main><SiteFooter /></>;
}
