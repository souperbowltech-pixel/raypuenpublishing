import type { Metadata } from "next";
import { publisherBrand } from "@/lib/book";
import { LibraryForm } from "./LibraryForm";

export const metadata: Metadata = {
  title: "Your copy | Puen Publishing",
  robots: { index: false, follow: false },
};

/**
 * puenpublishing.com/library: where a code from Ray, or from a Parent's Guide
 * receipt, becomes a download. Nothing on this page lists or names a book; the
 * code alone decides what is handed over.
 */
export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-bold text-ink">Your copy</h1>
          <p className="mt-2 text-ink-soft">Enter the code you received to download your book.</p>
          <LibraryForm />
          <p className="mt-6 rounded-2xl bg-paper-deep p-4 text-sm text-ink-soft">
            Your copy carries your name on every inside page and is for you only. Please do not pass it on.
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-ink-soft/80">{publisherBrand.fullCredit}</p>
      </div>
    </main>
  );
}
