# PUEN PUBLISHING & REGENCY PRESS — PROJECT MASTER STATUS REPORT
**Document Name:** `PROJECT_STATUS_AND_HANDOVER_REPORT.md`  
**Date:** Monday, September 14, 2026  
**Client:** Ray Puen (Regency Press / Puen Publishing / New Life Mission Board, Inc.)  
**Lead Engineer:** Huzaifah  
**Live Production URL:** [https://raypuenpublishing.vercel.app](https://raypuenpublishing.vercel.app)  
**GitHub Repository:** `https://github.com/souperbowltech-pixel/raypuenpublishing` (Branch: `main`)

---

> ## ⚠️ ACTION REQUIRED — ROTATE EXPOSED CREDENTIALS
>
> Earlier revisions of this document committed live secrets to a public repository:
> the Lulu `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET`, the Supabase project URL, and
> Stripe account/keys. Those values have now been **redacted from the current file,
> but redaction does NOT remove them from git history** — anyone can still recover
> them from previous commits.
>
> **All exposed credentials MUST be rotated immediately** (Lulu client key/secret,
> Stripe secret key, Supabase service-role and anon keys). See [`SECURITY.md`](SECURITY.md)
> for the full findings and the required manual rotation/configuration steps.

---

## 1. Executive Summary & Project Background

This project represents the digital storefront and community fulfillment infrastructure for **Ray Puen's children's publication venture**, operating under the primary Bowker ISBN publishing umbrella of **Regency Press (RP)** with **Puen Publishing** acting as the specialized 501(c)(3) educational imprint.

The platform is purpose-built to support:
1. **Retail Storefront:** Direct-to-consumer sales of Book 1 (*The Geezy Goober’s Guide to Icky Island: The Geezy Goober and the Magic Pen*) at \$6.99 with instant print-on-demand fulfillment.
2. **Institutional & Humanitarian Wholesale Portal:** Flat sponsorship tiers for the **Nepal Recovery Initiative Edition** (1:1 student matching for earthquake recovery schools).
3. **Interactive 19-Slot Digital Gamification Ledger:** Real-time sticker unlocking for Book 2, tracking page completion, comprehension quizzes (400 pts), and peer recruitment (300 pts) up to the 700-point threshold for unlocking Book 2 (`Unlock_Volume_2`); a relative's \$40 sponsorship separately unlocks Book 3.
4. **Print Fulfilment:** IngramSpark print-on-demand / distribution (API wiring pending IngramSpark credentials and print files).

---

## 2. What Has Been Completed & Verified (100% Operational)

### A. Official Bowker Registry & Legal Imprint Architecture
- **Footer & Metadata Synchronization:** Configured dual-entity legal credits across the entire application:
  `"Published by Regency Press under the Puen Publishing Imprint (An Educational Imprint of New Life Mission Board, Inc.)"` (single source: `lib/book.ts`).
- **Title Accuracy:** Bowker ISBN title constraints fully enforced:
  *Title:* **The Geezy Goober’s Guide to Icky Island**  
  *Subtitle:* **The Geezy Goober and the Magic Pen**
- **Brand Identity & Favicon:** Ray Puen's official gold crest colophon cropped and configured as browser favicon (`/favicon.ico`, `app/icon.png`, Apple touch icons).

### B. Cloud Database (Supabase) — Architected for 100,000+ Students
- **Database Engine:** Supabase PostgreSQL instance (project URL and keys are stored in private env vars, not committed).
- **High-Concurrency Table Schema (`scout_profiles`):**
  - Tracks unique student scout tokens (e.g. `CAPTAIN-RAY-700`).
  - Stores dynamic array of completed pages (`1` through `19`).
  - Validated quiz score (`0` to `400`) and referral score (`0` to `300`).
  - Generated total score (`quiz_score + referral_score`) with indexed status states (`In_Progress`, `Academic_Pass`, `Unlock_Volume_2`).
- **Real-Time Verification:** Flagship scout data successfully synced live to cloud database and verified.

### C. 19-Slot Digital Sticker Album & Gamification (`/dashboard/book2`)
- Interactive digital sticker album implementing all 19 unique virtue badges (Humility, Perseverance, Patience, Joy, Courage, Teamwork, etc.).
- Real-time client-to-cloud synchronization: Clicking any sticker immediately illuminates it from grayscale to vibrant color, updates local state, and writes to Supabase.
- Academic pass gate (400 pts) + friend referral gate (300 pts) triggering the **Book 2 unlock** (`Unlock_Volume_2`).

### D. Payments & Commerce (Stripe Sandbox Integration)
- Connected to Ray's official Stripe account (account ID and keys are stored in private env vars, not committed).
- Stripe keys (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are configured in the deployment environment only — never committed to the repository.
- **End-to-End Test Passed:** Retail checkout (\$6.99) and institutional tier checkouts execute cleanly and redirect to the branded `/checkout/success` receipt page.

### E. MailerLite Email Automation
- Production API connected with authenticated Bearer token.
- Verified target group mappings:
  - **Retail Buyers Group:** `198342920447722769`
  - **Institutional / Nepal Sponsors Group:** `198342926101645263`
- **Dual-Path Sync:** Guaranteed buyer capture via both Stripe Webhook and direct `/checkout/success` page retrieval (sanitized payload preventing field rejection). Live test confirmed subscriber creation.

### F. Print Fulfilment (IngramSpark)
- The earlier Lulu integration has been **removed** (`lib/lulu.ts` deleted); print fulfilment is now IngramSpark.
- The UI already references IngramSpark. Automatic print/ship orders are switched on once IngramSpark API access and print files (interior/cover PDFs, ISBN/trim spec) are provided. Until then paid orders are saved to the `orders` table with `fulfillment_status = 'pending'` so none are lost.

---

## 3. Issues Encountered & How They Were Resolved

| # | Issue Description | Root Cause | Technical Resolution | Status |
|---|---|---|---|---|
| **1** | Serverless 500 Error on API Routes | Vercel serverless functions run on a read-only filesystem where local JSON file writes fail. | Replaced local disk writes with in-memory fallbacks and direct Supabase PostgreSQL upserts. | **RESOLVED** |
| **2** | Stripe Secret Key Format Mismatch | Copying secret key from dashboard had minor case mismatch (`iMvf...` vs `imVf...`). | Re-authenticated and verified secret key with Node.js against Stripe Account API. | **RESOLVED** |
| **3** | MailerLite Subscriber Not Showing | MailerLite rejected subscriber payloads containing custom fields not yet declared in MailerLite schema. | Sanitized subscriber payload to pass standard email/name and direct group assignment. Verified live. | **RESOLVED** |
| **4** | Stripe Dashboard Time Difference (8:06 AM vs 1:04 PM PKT) | Misconception about transaction timing. | Explained UTC-4 (US Eastern Time) vs UTC+5 (PKT) timezone shift. Transaction recorded accurately. | **EXPLAINED** |

---

## 4. Immediate Action Items For Ray Puen (Client)

To move from Sandbox / Testing to **Live Commercial Launch**, Ray needs to address the following items:

1. **Stripe Account Live Activation:**
   - In Stripe Dashboard, click **"Activate your account"** to submit business tax ID / EIN and US bank account details for payouts.
   - Once activated, toggle off "Test mode" and generate **Live Keys** (`pk_live_...` and `sk_live_...`).
2. **IngramSpark API access & print files:**
   - Provide IngramSpark API credentials and print-ready files: Book 1 interior PDF, cover PDF(s), ISBN and trim spec.
3. **Custom Domain Connection (handled by our team, not the client):**
   - Link `puenpublishing.com` in Vercel project domain settings. DNS records:
     - `CNAME` for `www` pointing to `cname.vercel-dns.com`
     - `A` record for apex pointing to `76.76.21.21`

---

## 5. Architectural Diagram

```
[ Customer / Young Scout ]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│  Next.js 14 Web Application (raypuenpublishing.vercel.app) │
└──────┬────────────────────┬────────────────────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Stripe    │     │   Supabase   │     │  MailerLite  │
│ Payments API │     │ Cloud DB     │     │  Subscribers │
│  (Sandbox)   │     │ (100k Scale) │     │ (Automations)│
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       ▼ (700 Pts / Order)
┌────────────────────────────────────────────────────────┐
│           IngramSpark Print-On-Demand API              │
│        (Print Dispatch & Shipping — pending)           │
└────────────────────────────────────────────────────────┘
```

---

*Report prepared and certified by Development Team for client handover.*
