import Image from "next/image";
import { author } from "@/lib/book";

export function AboutAuthor() {
  return (
    <section className="container-page py-16">
      <div className="flex flex-col items-center gap-8 rounded-xl2 border border-ink/10 bg-paper p-8 shadow-card sm:flex-row sm:p-10">
        <Image
          src={author.photo.src}
          alt={author.photo.alt}
          width={200}
          height={200}
          className="h-32 w-32 flex-shrink-0 rounded-full object-cover shadow-card sm:h-40 sm:w-40"
        />
        <div>
          <p className="eyebrow">About the author</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
            {author.name}
          </h2>
          <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
            {author.bio}
          </p>
        </div>
      </div>
    </section>
  );
}
