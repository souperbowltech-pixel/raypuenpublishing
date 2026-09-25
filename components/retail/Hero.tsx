import Image from "next/image";
import { book1 } from "@/lib/book";
import { BuyBox } from "./BuyBox";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft decorative wash behind the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-spruce-light/40 via-paper to-paper"
      />
      <div className="container-page relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-14">
        <div className="order-2 lg:order-1">
          <p className="eyebrow">Independent children&apos;s imprint</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
            {book1.title}
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink-soft">
            {book1.tagline}
          </p>
          <p className="mt-2 font-display text-base font-semibold text-ink">
            {book1.byline}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-spruce-dark">
            <span className="rounded-full bg-spruce-light px-3 py-1">
              {book1.ageRange}
            </span>
            <span className="rounded-full bg-crayon-goldsoft px-3 py-1 text-ink">
              {book1.pageCount} pages
            </span>
            <span className="rounded-full bg-clay-light/60 px-3 py-1 text-clay-dark">
              Screen-free
            </span>
          </div>

          <div className="mt-8 max-w-sm">
            <BuyBox />
          </div>
        </div>

        <div className="order-1 flex justify-center lg:order-2">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-4 -rotate-3 rounded-xl2 bg-crayon-goldsoft"
            />
            <Image
              src={book1.coverImage.src}
              alt={book1.coverImage.alt}
              width={480}
              height={480}
              priority
              className="relative w-64 rotate-2 rounded-xl2 shadow-book sm:w-80"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
