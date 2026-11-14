import { Spinner } from "@/components/ui/Spinner";

/** Shown while /start waits (briefly) for the Bonus Video lookup. */
export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12 sm:py-16" aria-busy="true">
      <p className="inline-flex items-center gap-2 font-semibold text-ink-soft" role="status">
        <Spinner className="h-5 w-5 text-spruce" /> Getting your adventure ready…
      </p>
    </main>
  );
}
