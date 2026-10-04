# Puen Publishing & Regency Press — Executive Project Handover Document

**Project:** Puen Publishing E-Commerce & Gamification Platform  
**Live Production URL:** [https://puenpublishing.com](https://puenpublishing.com)  
**Client:** Ray Puen (Regency Press / Puen Publishing / New Life Mission Board, Inc.)  
**Lead Engineer:** Huzaifah  
**Version / Milestone:** Phase 1 Handover (October 2026)  

---

## Section 1: Executive Summary & What Was Built

The platform at **puenpublishing.com** serves as the digital storefront, institutional distribution hub, and gamified reading adventure for Ray Puen's children's literature venture: *The Geezy Goober’s Guide to Icky Island (The Search for the Magic Pen, Volume 1)*. 

Key capabilities delivered:
1. **Direct-to-Consumer Storefront:** High-converting book showcase featuring the authentic, high-resolution Book 1 front cover art (Nepal Recovery Initiative Edition with gold seal), real-time pricing, and seamless checkout.
2. **19-Slot Digital Gamification Engine (`/dashboard/book2`):** Real-time interactive virtue badge album (Humility, Joy, Perseverance, Integrity, Courage, etc.) backed by Supabase cloud storage. Tracks quiz scoring (400 points) and peer referrals (300 points) to unlock Volume 2 rewards.
3. **Stakeholder Demo Override (`/dashboard/book2?demo=1`):** A dedicated, unrestricted presentation mode for publisher meetings that instantly showcases the fully illuminated sticker ledger and completion state without prerequisite quizzes.
4. **Chief Scout Patrol Leader Funnel (`/guide`):** A $10 digital bundle generating unique Patrol Hub tokens and three gift invitation codes, with automated buyer email delivery and an administrative one-click approval gate for printed rewards.
5. **Institutional Wholesale Portal (`/institutions`):** Flat-rate wholesale sponsorship tiers ($40 / $200 / $400) tailored for preschools, church ministries, and homeschool networks with 1:1 student matching.
6. **Video Portal Destinations (`/v1` through `/v5`):** Permanently printed QR/URL destinations embedded in physical books. Displays embedded video players when connected, or a child-friendly status message when pending.
7. **Production Email & Webhook Infrastructure:** Fully authenticated custom transactional email engine via Resend (`send.puenpublishing.com`) and real-time failure alerting via Google Apps Script relay.

---

## Section 2: Architecture & Technology Stack

The platform is engineered as a modern, decoupled cloud application with high resilience and serverless execution:

| Layer | Technology | Purpose & Implementation Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14 (App Router)** | Server Components + Client hydration, React 18, Tailwind CSS. |
| **Hosting Platform** | **Vercel Serverless Edge** | Global CDN distribution, automatic HTTPS, branch previews, zero-downtime deployments. |
| **Database** | **Supabase (PostgreSQL)** | Persistent storage for scout profiles, progress arrays, patrol leader tokens, and orders. |
| **Payment Gateway** | **Stripe API** | Secure hosted checkout sessions for retail, patrol bundles, and wholesale packages. |
| **Transactional Email** | **Resend API (HTTP)** | One-to-one transactional notifications with strict timeout guards and secret scrubbing. |
| **DNS & Mail Routing** | **Namecheap DNS** | SPF, DKIM, and MX records configured on dedicated subdomain `send.puenpublishing.com`. |
| **Incident Alerting** | **Google Apps Script** | Webhook relay dispatching revenue-critical server alerts directly to administration Gmail. |
| **Automated Testing** | **Vitest (Node Environment)** | 325 strict automated tests verifying math, auth boundaries, timeouts, and redaction. |

---

## Section 3: Credentials & Access Architecture

All sensitive credentials and API tokens are managed strictly through environment variables. Zero credentials are committed to the public Git repository.

### Environment Variable Map

| Variable Key | Scope | Description & Location |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | Client / Server | Canonical public URL (`https://puenpublishing.com`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Client / Server | Public API endpoint of the Supabase PostgreSQL project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client / Server | Public anonymous API key for client-side queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | High-privilege key used for secure server-side mutations. |
| `STRIPE_SECRET_KEY` | Server Only | Secret API key for creating Stripe checkout sessions. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client / Server | Stripe publishable key for client checkout redirect. |
| `STRIPE_WEBHOOK_SECRET` | Server Only | Signing secret used to verify webhook event integrity. |
| `RESEND_API_KEY` | Server Only | Bearer token for authenticating with the Resend email API. |
| `EMAIL_FROM` | Server Only | Sender address: `The Chief Explorer <explorer@send.puenpublishing.com>`. |
| `ADMIN_EMAIL` | Server Only | Recipient for free guide claims (`info@puenpublishing.com`). |
| `ADMIN_TOKEN` | Server Only | Secret string (16+ chars) protecting `/admin` and detailed `/api/health`. |
| `ALERT_WEBHOOK_URL` | Server Only | Google Apps Script endpoint receiving emergency incident logs. |

---

## Section 4: Production Deployment & Server Runbook

### Deployment Procedure
The project is connected to Vercel via GitHub continuous integration. Every push to the `main` branch automatically builds and deploys to production:

1. **Local Checks Before Pushing:**
   ```bash
   # 1. Typecheck
   npx tsc --noEmit

   # 2. Code Linting
   npm run lint

   # 3. Automated Test Suite
   npx vitest run
   ```

2. **Deploying via Git:**
   ```bash
   git add <modified_files_by_name>
   git commit -m "feat/fix: descriptive message"
   git push origin main
   ```

3. **Vercel Manual Redeploy:**
   - Navigate to [vercel.com](https://vercel.com) -> `raypuenpublishing` project.
   - Go to **Deployments** tab.
   - Click the three dots `...` on the active deployment and select **Redeploy**.

4. **Domain Routing & Canonical 308 Redirect:**
   - Primary Domain: `puenpublishing.com`
   - Secondary Domain: `www.puenpublishing.com` -> redirects to `puenpublishing.com`
   - Platform Domain: `raypuenpublishing.vercel.app` -> 308 permanent redirect to `puenpublishing.com`.

---

## Section 5: Database Schema & Migration Status

The database is structured into four core relational tables within Supabase PostgreSQL:

1. **`scout_profiles`:**
   - `token` (Text, Primary Key): Unique scout identifier (e.g., `SC-xxxx` or `CAPTAIN-RAY-700`).
   - `scout_name` (Text): Child's name.
   - `completed_pages` (Integer Array): Array of registered pages ($1..19$).
   - `quiz_score` (Integer): Score achieved on comprehension quiz ($0..400$).
   - `referral_score` (Integer): Score achieved from recruited friends ($0..300$).
   - `status` (Text): Progression tier (`In_Progress`, `Academic_Pass`, `Unlock_Volume_2`).
   - `friends_completed` (Integer): Counter of friends who registered page 1 ($0..3$).
   - `book3_sponsored` (Boolean): Flag unlocked when relative sponsors Book 3 ($40).

2. **`patrol_leaders`:**
   - `id` (UUID, Primary Key): Unique patrol identifier.
   - `email` (Text): Buyer's email address.
   - `token` (Text): Secret access token for Patrol Hub.
   - `gift_codes` (Text Array): Array of three unique gift codes issued to buyer.
   - `registered_families` (Integer): Number of redeemed gift codes.
   - `claimed_printed_guide` (Boolean): Claim status for physical guide reward.

3. **`patrol_gifts`:**
   - `code` (Text, Primary Key): Unique gift voucher code (`GP-xxxx`).
   - `patrol_id` (UUID): Reference to parent patrol leader.
   - `redeemed_by` (Text): Email of recipient family who claimed the code.
   - `redeemed_at` (Timestamp): Exact time of activation.

4. **`videos`:**
   - `slug` (Text, Primary Key): URL identifier (`v1`, `v2`, `v3`, `v4`, `v5`).
   - `title` (Text): Display title of video episode.
   - `youtube_id` (Text): YouTube Unlisted ID (when empty, displays polite waiting card).
   - `status` (Text): `live` or `pending`.

*Migration Status: All migrations (`20260926_add_scout_referrals.sql`, `20260926_create_patrol_and_guides.sql`, and `videos` table) are fully applied and verified live via `/api/health`.*

---

## Section 6: Background Tasks & Automation Architecture

The platform runs purely on serverless event-driven architecture, avoiding fragile server cron daemons:

* **Stripe Webhook Event Processing (`/api/webhooks/stripe`):**
  - Listens for `checkout.session.completed` events.
  - Automatically discriminates order type (`retail`, `patrol_bundle`, `sponsor_volume_3`, `wholesale`).
  - Automatically generates gift codes and emails buyer receipt with zero human intervention.
* **Transactional Email Dispatch:**
  - Sent through Resend HTTP endpoint with strict 8-second execution deadlines to prevent serverless execution stalls.
  - Automatic fallback alerting to admin email if webhook transport fails.
* **Crash & Error Alerting:**
  - Revenue-critical paths route unexpected failures to `alertFailure()`.
  - Dispatches incident notifications to Google Apps Script relay, landing directly in the administrative inbox.

---

## Section 7: Verification & Test Suite Results

The codebase contains a comprehensive automated test suite enforced through Vitest:

* **Total Test Files:** 37 test files passing (100% clean).
* **Total Automated Tests:** **325 tests passing**.
* **Typecheck Status:** `npx tsc --noEmit` exits with **0 errors**.
* **Linting Status:** `npm run lint` exits with **0 errors**.

### Key Test Coverage Highlights:
- **Gamification Arithmetic (`lib/gamification.test.ts`):** Verifies 400-point quiz scoring, 300-point friend logic, and the 700-point Volume 2 unlock boundary.
- **Authorization & Security (`lib/scout-access.test.ts`):** Proves scout token ownership, constant-time token comparison, and cookie security.
- **Patrol Funnel (`lib/patrol.test.ts`):** Verifies receipt generation, 3-gift-code issuance, and approval gate security.
- **Redaction Hygiene (`lib/redact.test.ts`):** Proves customer shipping addresses and authentication tokens are scrubbed from server logs.
- **API Endpoints (`app/api/**/*.test.ts`):** 100% route coverage testing successful orders, network timeouts, and invalid payloads.

---

## Section 8: Support & Maintenance Guidelines

### Quick Troubleshooting Cheat Sheet

1. **A Customer Says They Didn't Receive Their $10 Patrol Receipt Email:**
   - Log in to [resend.com/emails](https://resend.com/emails) -> Check the delivery log for the customer's email.
   - The link can also be looked up directly from their Stripe session ID via the database.

2. **Adding a New Video to `/v1` through `/v5`:**
   - No code deployment is needed.
   - Open Supabase Dashboard -> Table Editor -> `videos` table.
   - Update the row for `v1` with the YouTube Unlisted video ID and set `status` to `live`.

3. **Approving a Family's Free Printed Parent's Guide:**
   - Visit `https://puenpublishing.com/admin`.
   - Enter your `ADMIN_TOKEN` when prompted.
   - Review pending claims and click **Approve** to record fulfillment.

4. **Switching Stripe from Test Mode to Live Mode:**
   - Go to Vercel -> Settings -> Environment Variables.
   - Replace `pk_test_...` and `sk_test_...` with your `pk_live_...` and `sk_live_...` keys from the Stripe Dashboard.
   - Add the live `STRIPE_WEBHOOK_SECRET` (`whsec_...`).
   - Trigger a Redeploy in Vercel.

---

*Handover document compiled and verified for Regency Press & Puen Publishing — October 2026.*
