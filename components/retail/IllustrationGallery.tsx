"use client";

import { useState } from "react";
import Image from "next/image";
import { book1 } from "@/lib/book";
import { Lightbox } from "@/components/ui/Lightbox";

export function IllustrationGallery() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const images = book1.gallery;

  return (
    <section id="gallery" className="container-page py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Peek inside</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
          A look at the pages
        </h2>
        <p className="mt-3 text-ink-soft">
          Big, open illustrations with thick outlines — easy for little hands to
          colour. Tap any page to see it up close.
        </p>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.src}>
            <button
              type="button"
              onClick={() => setActiveIndex(i)}
              className="group block w-full overflow-hidden rounded-xl2 border border-ink/10 bg-paper shadow-card transition hover:-translate-y-1 hover:shadow-book focus-visible:-translate-y-1"
              aria-label={`Open ${img.alt}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={700}
                height={700}
                className="aspect-square h-auto w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <Lightbox
        images={images}
        index={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
      />
    </section>
  );
}
