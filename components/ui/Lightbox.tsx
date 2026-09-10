"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import type { GalleryImage } from "@/lib/book";

interface LightboxProps {
  images: GalleryImage[];
  index: number | null;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}

/**
 * Accessible modal lightbox with keyboard support (Esc / ← / →).
 * Rendered only when `index` is a number.
 */
export function Lightbox({ images, index, onClose, onNavigate }: LightboxProps) {
  const isOpen = index !== null;

  const goPrev = useCallback(() => {
    if (index === null) return;
    onNavigate((index - 1 + images.length) % images.length);
  }, [index, images.length, onNavigate]);

  const goNext = useCallback(() => {
    if (index === null) return;
    onNavigate((index + 1) % images.length);
  }, [index, images.length, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }

    document.addEventListener("keydown", onKey);
    // Prevent background scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, goPrev, goNext]);

  if (index === null) return null;
  const current = images[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Illustration preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-paper/90 text-2xl font-bold text-ink hover:bg-paper"
      >
        ×
      </button>

      <button
        type="button"
        aria-label="Previous illustration"
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
        className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-paper/90 text-2xl text-ink hover:bg-paper"
      >
        ‹
      </button>

      <figure
        className="max-h-[85vh] max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-xl2 bg-paper shadow-book">
          <Image
            src={current.src}
            alt={current.alt}
            width={900}
            height={900}
            className="h-auto w-full max-h-[72vh] object-contain"
          />
        </div>
        <figcaption className="mt-3 text-center text-sm text-paper/90">
          {current.alt} · {index + 1} / {images.length}
        </figcaption>
      </figure>

      <button
        type="button"
        aria-label="Next illustration"
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
        className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-paper/90 text-2xl text-ink hover:bg-paper"
      >
        ›
      </button>
    </div>
  );
}
