import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-2xl border border-ink/10 bg-paper p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl text-amber-600">
          ✕
        </div>

        <p className="eyebrow mb-2">Checkout Incomplete</p>
        <h1 className="font-display text-3xl font-bold text-ink">
          Order Cancelled
        </h1>

        <p className="mt-4 text-base text-ink-soft leading-relaxed">
          No charges were made to your account. Whenever you are ready, you can
          return to the storefront to complete your purchase.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/#buy" className="btn-primary w-full text-center">
            Return to Store & Try Again
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
