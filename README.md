# Puen Publishing — Storefront (Milestone 1)

Frontend and pricing engine for **Puen Publishing**, an independent imprint
selling children's coloring books. This is **Milestone 1 of 2**. Payment,
print fulfilment and email integrations (Stripe, Lulu, MailerLite) arrive in
Milestone 2 — this milestone ships clean, well-typed stubs those can plug into.

## What's in this milestone

- **Public retail landing page** (`/`) — hero with Book 1's cover, an interior
  illustration gallery with a lightbox, book details, price, a "Buy Now" CTA,
  and trust blocks (author, shipping/returns). Mobile-first.
- **Hidden institutional wholesale portal** (`/institutions`) — not linked in
  the nav, reachable by direct URL only. Bulk order form with a **live pricing
  calculator** and a celebratory "reward" state when an order crosses the
  100-copy threshold (fee waived + free Teacher's Master Manual).
- **Pricing engine** (`lib/pricing.ts`) — one config file, one pure function,
  fully unit-tested.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) for unit tests
- Deploys to Vercel with no extra configuration

---

## Setup

Requires **Node.js 18.18+** (Node 20+ recommended).

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # run the production build
npm run lint       # eslint
npm test           # run the pricing unit tests once
npm run test:watch # run tests in watch mode
```

The retail page is at `/`. The hidden wholesale portal is at
[`/institutions`](http://localhost:3000/institutions).

> **Buy / Submit buttons:** In Milestone 1 these call stub functions
> (`initiateRetailCheckout` / `initiateWholesaleCheckout`) that build the order
> payload and **log it to the browser console**. Open DevTools → Console to see
> the exact payload a backend will receive in Milestone 2. No payment is taken.

---

## How to change prices  (no coding experience needed)

**All prices live in one place:** [`lib/pricing.ts`](lib/pricing.ts), at the
top of the file in the `PRICING` block. Edit only the numbers:

```ts
export const RETAIL_PRICE = 6.99;          // public price per book
export const WHOLESALE_UNIT_PRICE = 4.19;  // bulk price per book
export const DIGITAL_FEE = 20.00;          // fee on small bulk orders
export const FREE_MANUAL_THRESHOLD = 100;  // copies needed to unlock the reward
```

Rules for editing:

- Use plain numbers (dollars). **No `$` signs and no commas** — write `1000`,
  not `$1,000`.
- The whole site (retail price, wholesale calculator, the "40% off" label, the
  reward threshold) updates automatically from these four numbers.
- After changing a price, run `npm test` to confirm everything still adds up.

> ⚠️ The **100-copy threshold** is the basis of the institutional sales pitch.
> If you change `FREE_MANUAL_THRESHOLD`, the boundary tests in
> `lib/pricing.test.ts` are written for `100` and will need their numbers
> updated to match.

---

## How to swap in the real book images

Placeholder art lives in [`public/placeholders/`](public/placeholders/). To use
real images, **replace those files, keeping the same file names** — nothing else
needs to change:

| File | Used for |
| --- | --- |
| `cover.svg` | Book 1 front cover (hero) |
| `interior-1.svg` … `interior-4.svg` | Interior page gallery |
| `author.svg` | Author portrait |

Two ways to do it:

1. **Easiest** — save your real images with the exact same names (e.g. replace
   `cover.svg` with a file also named `cover.svg`). Any web format works
   (`.jpg`, `.png`, `.webp`, `.svg`).
2. **If you use different file names / formats** — drop your files in
   `public/placeholders/` and update the paths in one file:
   [`lib/book.ts`](lib/book.ts) (the `book1` and `author` objects). All text
   copy for the book also lives in `lib/book.ts`.

> Placeholder text throughout the site is marked `[PLACEHOLDER ...]`. Search for
> that tag in `lib/book.ts` to find everything that needs real copy.

---

## Project structure

```
app/
  layout.tsx              # fonts + global shell
  page.tsx                # retail landing page (composes the sections)
  institutions/page.tsx   # hidden wholesale portal (noindex)
  globals.css             # Tailwind + design-system component classes
components/
  retail/                 # Hero, BuyBox, gallery, details, author, shipping
  institutions/           # WholesaleForm + live PricingCalculator
  ui/Lightbox.tsx         # accessible image lightbox
lib/
  pricing.ts              # ← the single source of truth for all pricing
  pricing.test.ts         # unit tests (incl. the 99/100/101 boundary)
  checkout.ts             # initiateRetail/WholesaleCheckout stubs + payloads
  book.ts                 # book content, copy, image paths (edit here)
public/placeholders/      # swappable placeholder images
.env.example              # every variable Milestone 2 will need
```

---

## Milestone 2 (not built yet)

`.env.example` documents every variable the next milestone needs (Stripe, Lulu,
MailerLite). The integration points are already isolated:

- **`lib/checkout.ts`** — replace the `console.log` in each stub with a real
  request. The payload shapes (`RetailOrderPayload`, `WholesaleOrderPayload`)
  are backend-ready and include the full pricing breakdown.
- **`lib/pricing.ts`** — pricing math stays here; the backend can import
  `calculateWholesalePrice` to re-verify totals server-side before charging.

## Notes / constraints honoured

- No `localStorage` / `sessionStorage` anywhere.
- No Stripe / Lulu / MailerLite code — clean stubs only.
- All book copy is obvious placeholder text (`[PLACEHOLDER ...]`).
- Pricing logic is deliberately simple, readable, and thoroughly tested.
```
