# Puen Publishing — Children's Coloring Book Platform

Production e-commerce and interactive gamification platform for **Puen Publishing**, an educational imprint of New Life Mission Board, Inc. co-created by Ray Puen.

Live production site: **[https://puenpublishing.com](https://puenpublishing.com)**

---

## 🌟 Core Features & Architecture

- **Retail Storefront (`/`)**
  - Interactive book showcase for *The Geezy Goober's Guide to Icky Sfand: The Search for the Magic Pen (Volume 1)*.
  - Trim size: 8.5" × 11" US Letter format (32+ pages).
  - Secure Stripe Checkout ($6.99) with real-time stock and shipping collection.

- **Family Accounts & Chief Explorer Portal (`/start`, `/dashboard/book2`)**
  - Frictionless passwordless family account onboarding via SHA-256 hashed session cookies (`family_sessions`).
  - Gamified reading journey with 19 interactive virtue merit-badge stickers (Kindness, Courage, Integrity, etc.).
  - Academic Comprehension Quiz engine (400 points).
  - Real 2-of-3 friend referral engine (300 points) unlocking Book 2 completely free upon reaching the Biblical 700 points.
  - Grandpa Multiplier track ($40 sponsorship) pre-approving Book 3 unlock.

- **Parent's Guide & Chief Scout Patrol Funnel (`/guide`, `/dashboard/patrol`)**
  - Digital Parent's Guide & Teacher's Master Manual ($29.97 digital edition).
  - Chief Scout Patrol Leader bundle ($10.00 loss-leader) generating 3 unique gift invitation QR codes (`GP-XXXXXX-1..3`).
  - Patrol Leader dashboard tracking real family gift redemptions in real time.
  - Ray's One-Click Approval Gate (`/api/admin/approve-guide`) with cryptographically signed tokens to approve free printed Guide fulfillments.

- **Institutional Sponsorship Portal (`/institutions`)**
  - Flat-rate packages ($40 / $200 / $400) sponsoring 10 / 48 / 100 copies with a 1:1 publisher match.
  - Free complimentary author copy shipped for Premium Sponsor tiers (Tiers 2 & 3).
  - Automatic itemized Stripe invoice generation (`invoice_creation`) for school and church reimbursements.

- **Printed Video Pages (`/v1` … `/v5`)**
  - Five printed addresses embedded in Book 1 connecting to dynamic database-driven video records in Supabase (`videos` table).
  - Fallback "video on its way" presentation screens so printed QR codes never 404.

- **Print-Ready Sticker Sheet PDF (`/api/stickers/sheet`)**
  - Dynamic streaming 8.5" × 11" US Letter PDF with all 19 merit badges laid out for home-printing on adhesive paper.

- **Health & Diagnostics (`/api/health`)**
  - Live 8-point connectivity probe verifying database read/write, schema migrations, and table integrity.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router, Server Components, Route Handlers) + TypeScript 5
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with custom storybook design system tokens
- **Database & Storage:** [Supabase](https://supabase.com/) (PostgreSQL with RLS) + local fallback store
- **Payments:** [Stripe](https://stripe.com/) Checkout Sessions & Signed Webhook Handlers
- **PDF Generation:** [pdf-lib](https://pdf-lib.js.org/)
- **QR Code Generation:** [qrcode](https://www.npmjs.com/package/qrcode)
- **Testing:** [Vitest](https://vitest.dev/) (110+ unit & integration tests)
- **CI / CD:** GitHub Actions (`.github/workflows/ci.yml`) + Vercel Deployment

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Installation & Local Development

```bash
# Install dependencies
npm install

# Run local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the storefront.

### Quality & Verification Suite

```bash
# Run all unit and integration tests
npm test

# Run TypeScript typecheck
npm run typecheck

# Run Next.js linter
npm run lint

# Run production build
npm run build
```

---

## 🔒 Security & Reliability Guarantees

1. **Origin Header Enforcement (SEC-01):** Stripe checkout return URLs strictly derive from authoritative site origin (`NEXT_PUBLIC_SITE_URL`), preventing client-controlled phishing redirects.
2. **Rate Limiter Edge IP Protection (SEC-02):** Prioritizes Vercel Edge `x-real-ip` to prevent header spoofing on public endpoints.
3. **Optimistic Concurrency & Idempotency:** Scout state and family sessions use versioning and optimistic concurrency with retry logic.
4. **Data Isolation & Secrets:** Private scout tokens and database service keys are strictly server-side and never exposed to client bundles.
