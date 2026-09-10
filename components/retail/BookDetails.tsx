import { book1 } from "@/lib/book";

const specs = [
  { label: "Age range", value: book1.ageRange },
  { label: "Page count", value: `${book1.pageCount} pages` },
  { label: "Dimensions", value: book1.dimensions },
  { label: "Format", value: "Softcover · matte finish" },
];

export function BookDetails() {
  return (
    <section id="details" className="bg-paper-deep py-16">
      <div className="container-page grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="eyebrow">About the book</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
            {book1.title}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
            {book1.description}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl2 border border-ink/10 bg-ink/10">
          {specs.map((spec) => (
            <div key={spec.label} className="bg-paper p-5">
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                {spec.label}
              </dt>
              <dd className="mt-1 font-display text-lg font-semibold text-ink">
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
