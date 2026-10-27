# Open work and the Stripe go-live runbook

_Written 14 October 2026. This file is the short list of what is actually outstanding, plus the
exact steps for taking payments live. `docs/BACKLOG.md` covers audit findings; this file covers
what we owe the client and what the operator must do by hand._

---

## 0. 23 to 24 October 2026: Book 1 is not print ready, and the tiers do not cover printing

Ray sent the corrected interior, the cover, the shipment letter and his IngramSpark screenshot in
one day, and asked for approval on all of it. Nothing here is approved yet. Every item below was
measured from the files, not judged by eye.

### 0.1 The interior, `files from ray/231026/Book 1 complete (1).pdf`

| Finding | Detail |
|---|---|
| **Copyright page is blank** | Page 3 carries the frame, the word Copyright and an empty ISBN rule. No notice, no year, no publisher, no rights reserved. The wording was sent on 15 Oct and never placed |
| **35 pages, an odd count** | A perfect bound interior must be even. IngramSpark will reject it. Recommend 36, which also leaves room for the welcome square |
| **No welcome video square** | Agreed on 21 Oct that `/v6` sits at the foot of the This Journey Belongs to page. That page has no frame |
| **Resolution below spec** | 29 of 35 pages run 245 to 266 DPI against a 300 minimum. Page 31, which carries a QR frame, is **199 DPI** |
| **Mixed colour spaces** | Pages 1, 10, 18, 25, 33, 34 are CMYK at 360 DPI. The other 29 are RGB at roughly 250. One file should be one colour space |
| **Produced in Canva by "Aymane"** | The PDF metadata names Aymane as author, not Sarah. Every page is a flat image at its own arbitrary pixel size, so there is no text layer anywhere and no vector line art |

Two places where the printed book promises what the system does not do:

- **Page 34** says registering two friends unlocks Book 2 free. `BOOK2_GATE_CONFIG` opens Book 2 at
  **700 points**; two friends earn **300**. The other 400 come from the quiz. A child following that
  page exactly will not receive Book 2.
- **The book has 25 character traits. `STICKER_SLOT_COUNT` is 19.** A child colouring all 25 pages
  runs out of album slots at 19.

**Good news worth keeping:** all six QR frames are drawn and correctly placed, Video 1 to 3 on the
three Teamwork Challenge pages, Video 4 on Gratitude, Video 5 on the jingle page and registration on
the Secret Scout Club page. The Teamwork Challenge page **is** the adult colouring page, which
settles Sarah's question and confirms Ray was right.

### 0.2 The cover, `files from ray/231026/book 1 cover 4k.png`

| Finding | Detail |
|---|---|
| **The printed web address is the old one** | The Pay-It-Forward panel reads `raypuenpublishing.vercel.app/institutions`. It must be `puenpublishing.com/institutions`. This is permanent once printed |
| **Cover title does not match the title page** | Cover: *Volume 1: The Search for the Magic Pen*. Interior title page: *The Geezy Goober's Guide to Icky Sfand, Volume 1*. These must agree, and must match the ISBN registration |
| **Typo in the sales copy** | "to prevent by market bleed-through" should read marker bleed-through |
| **Institutional text on the retail cover** | The Covenant panel tells the reader the volume "was fully sponsored and gifted to your local educational network" and that they may "retain 100% of the funds raised from selling this book". Print on demand has one cover per ISBN, so every retail buyer reads this |
| **236 DPI** | 4096 x 2635 px. A 36 page wrap at 8.5 x 11 needs about **5202 x 3375** to reach 300 DPI |
| **Not built on the IngramSpark template** | The proportions are close but not exact, and spine width depends on the final page count, which is still undecided. The cover cannot be finished before the interior count is fixed |
| Ages claim | "Perfect for independent readers ages 3 to 7" contradicts the read-aloud line beside it. A three year old is not an independent reader |

Correct as drawn: the blank spine is right at this page count, and the barcode sits on its own white
panel as IngramSpark requires. ISBN **978-0-9795930-1-7** is on the artwork.

### 0.3 The sponsor tiers do not cover the cost of printing

Read from `lib/pricing.ts` on 23 Oct. Every tier prices a printed book at almost exactly two dollars:

| Tier | Price | Books printed | Per book |
|---|---|---|---|
| 1 Community Seed | $40 | 20 | **$2.00** |
| 2 Co-Op Multiplier | $200 | 96 | **$2.08**, plus a free copy posted to the sponsor |
| 3 Kingdom Multiplier | $400 | 200 | **$2.00**, plus a free copy posted to the sponsor |

Two dollars is below the old black and white estimate of $2.20, and that estimate predates the
current specification. So **if the real print cost lands above $2.00, every sponsorship loses
money**, and if it lands exactly on $2.00 then **nothing at all reaches the Nepal relief effort**,
which is the whole premise of the page.

This is larger than the $15 gift letter, because the tiers are live on the site today. All three
need recalculating the moment the IngramSpark figure arrives.

### 0.4 The entity proposal of 23 October. SUPERSEDED by 0.5, kept for the reasoning

**This route was dropped on 24 October.** Read 0.5 for what was actually done.

Ray proposed making **Phyto Science USA** the parent of Puen Publishing by a county filing, and
using its $300,000 loss carryover while the 501(c)(3) is pending.

A county filing of that kind is a **fictitious business name, not a subsidiary**. The result is that
PSUSA is the seller trading as Puen Publishing: PSUSA's EIN in Stripe, PSUSA's bank account, PSUSA
on the IngramSpark agreement. He has been told this and asked to confirm with his accountant whether
the carryover is usable at entity level at all.

**Consequence for the book:** the Letter from the Author tells the reader their purchase joined the
rescue team. Under a commercial parent that is a sale which then supports the mission, so the
sentence needs a light edit to avoid reading as a charitable donation.

---

### 0.5 24 October: the entity is final, and two things are now open

**The entity is settled.** The IRS has issued a **new EIN** to **New Life Mission Network, Inc.**
State filing done, federal nearly done. Phyto Science USA is out, and so is the earlier idea of a
subsidiary borrowing a parent's number: this is a separate entity with its own.

**The name has to be corrected in three places before anything is submitted.**

| Where | What it must say |
|---|---|
| Copyright page | `Copyright © 2026 New Life Mission Network, Inc.`, and the publisher line as an imprint of the same. The wording sent on 23 Oct said **Board**, which is now wrong |
| Stripe | Legal name New Life Mission Network, Inc., the new EIN, and a payout bank account **in that same name**. Do not tick the 501(c)(3) option until the determination letter arrives |
| IngramSpark | Same name, same EIN |

**The Covenant panel is resolved.** Ray had begun doubting Pay-It-Forward himself, on the sound
ground that he cannot measure it beyond the second generation, and prefers selling to schools at a
discount so they keep the retail proceeds. That model is already built at `/institutions`.

Agreed principle, worth keeping for every future printed surface: **the cover carries only what
stays true, and points at a page we can edit.** He accepted the replacement paragraph and sent it
to Sarah. The two paragraphs of reasoning beneath it were for him, not for the panel, and he read
that correctly.

**🔴 Open and genuinely risky: who owns the illustrations.**

The copyright page claims the whole book for New Life Mission Network, Inc. Sarah drew it. Unless
she has **assigned copyright in writing**, or drew under a written work for hire agreement, the
artwork's copyright is still hers and that line is not true.

This surfaced sideways. Ray said Sarah has always refused to give her surname and proposed
**deleting her credit altogether**. He was advised not to, since a single name credit is normal and
removing it would be the stranger choice, and asked instead whether he holds anything in writing
from her. He has not yet answered.

**It should be settled before the book is printed, not after.** A one page assignment is cheap now
and impossible to insist on once an ISBN is registered and copies exist. Note that an illustrator
who will not give a surname is unlikely to have signed anything.

**Also open at the close of 24 October:**

- The three IngramSpark quantity runs, 1, 2 and 25. Ray will telephone them.
- Shipping costs, which he cannot get out of IngramSpark yet.
- Whether he accepts the classroom clause in the copyright wording.
- How Sarah wishes to be credited.

Ray resumes **Sunday 26 October**.

---

## 1. Stripe: taking real payments

### 1.1 The gate, before anything else

**Ray stopped Stripe himself on 29 September.** His words: his lawyer raised a matter that "may
span several years to be researched", and he asked us to hold off until further notice.

**Nothing below happens until Ray says, in writing, that the legal matter is settled.** He asked
on 2 October whether his go-ahead was all that was needed and we confirmed it was. That go-ahead
has not arrived. Do not flip the switch on a verbal or an assumed yes.

### 1.2 What the code actually needs

Only **two** environment variables matter. Verified in the source on 14 Oct:

| Variable | Read by | Note |
|---|---|---|
| `STRIPE_SECRET_KEY` | `lib/stripe.ts:5` | The only key used server-side |
| `STRIPE_WEBHOOK_SECRET` | `app/api/webhooks/stripe/route.ts:18` | Live endpoints get their own secret |

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is listed in `docs/HANDOVER.md` but **nothing in the code
reads it**. Checkout is redirect-based, so no publishable key is needed. Do not spend time on it.

### 1.3 Ray's side, first

1. Stripe dashboard, complete account activation: business details, EIN, payout bank account.
2. Stripe runs its own verification. This takes days, not minutes, and is not in our hands.

He already sent those details once, on 29 September, over Fiverr chat. **They were never recorded
anywhere in this project and must not be.** He enters them himself, or the operator enters them
with him present. An assistant never types a bank or tax identifier into a form.

### 1.4 Operator's side, once activation clears

3. Stripe dashboard, turn the **Test mode** toggle **off**.
4. Developers, API keys, copy the **Secret key** (`sk_live_...`).
5. Developers, Webhooks, **Add endpoint**:
   - URL: **`https://www.puenpublishing.com/api/webhooks/stripe`**
   - Event: **`checkout.session.completed`** only. Nothing else is handled
     (`app/api/webhooks/stripe/route.ts:39`), so subscribing to more just creates noise.

   **The `www` is not optional, and leaving it off cost us a failed test on 19 October.** Both
   `raypuenpublishing.vercel.app` and the bare `puenpublishing.com` answer a webhook POST with a
   **308 redirect** to the www host. **Stripe does not follow redirects**, so it records a failure
   and the event is never delivered. Verified by hand:

   ```
   raypuenpublishing.vercel.app/api/webhooks/stripe  -> 308
   puenpublishing.com/api/webhooks/stripe            -> 308
   www.puenpublishing.com/api/webhooks/stripe        -> 400 "Missing stripe-signature header"
   ```

   The 400 is the correct answer: the endpoint is alive and refusing an unsigned request.
6. Copy that endpoint's **Signing secret** (`whsec_...`). **It is different from the test one.**
   Using the test secret against live traffic fails every signature check and silently drops
   every paid order.
7. Vercel, Project, Settings, Environment Variables, set both values for **Production**.
8. Vercel, Deployments, **Redeploy**. Environment changes do not apply to a running deployment.

### 1.4b The $10 Patrol flow is now proven end to end. 20 October 2026.

Open since September: the paid Patrol branch had unit tests but had never survived a real payment.
It has now, in test mode, and it failed the first time for a reason worth keeping:

**The webhook was pointed at `raypuenpublishing.vercel.app`, which answers a POST with a 308
redirect. Stripe does not follow redirects**, so every event failed. The dashboard showed a 100%
error rate that nobody had looked at. Changing the destination to the **www** host fixed it. See the
box in step 5: the bare `puenpublishing.com` would have failed in exactly the same way.

What the second attempt proved, all four links in the chain:

| Step | Result |
|---|---|
| Payment | Taken by Stripe |
| Webhook delivery | 200 |
| `patrol_leaders` row and the hub page | Created, opens, tracker reads 0 / 3 |
| Three gift codes | `GP-QR365V-1`, `-2`, `-3` |
| Receipt email | **Delivered**, confirmed in the Resend log |

**Had this not been tested, going live would have taken real money and created nothing.** No order
row, no gift codes, no email, and a buyer left on "Your Patrol is being set up" forever, while the
Stripe dashboard showed the payment as successful. That is the shape of failure that runs for months
before anybody complains.

The same webhook misconfiguration would have applied to retail, wholesale and sponsor orders.

---

### 1.5 Proving it, which is not optional

9. Place one real `$6.99` retail order with a real card.
10. Check all four, not just the first:
    - Stripe shows the payment succeeded.
    - Stripe shows the webhook returned **200**, not 400. A 400 means the signing secret is wrong.
    - A row appeared in the Supabase `orders` table with `fulfillment_status` set.
    - The confirmation email arrived.
11. Refund the order in Stripe.

Steps 9 to 11 are the whole point. A green key in Vercel proves nothing.

### 1.6 Known gap, worth fixing before go-live

`lib/stripe.ts:5-7` falls back to a placeholder key when `STRIPE_SECRET_KEY` is unset, so the
Vercel build can evaluate the module. That is reasonable for build time, but there is **no runtime
guard**: if the variable were ever missing or misspelled in production, checkout would fail with
an opaque Stripe authentication error rather than an honest "payments are not configured" message,
and nothing would alert us.

Low risk while the variable is set correctly, but it is the difference between a clear failure and
a confusing one on the day money starts moving.

---

## 2. What we promised Ray and have not delivered

| # | What | Promised | State |
|---|---|---|---|
| 1 | **Book 2 copyright page and title page wording** | 6 Oct, "I will write it now and have it to you shortly" | **Outstanding. He accepted the offer and is waiting.** Book 2 cannot go to print without it |
| 2 | Video lock, gating `/v1` to `/v5` on the child's progress | 6 Oct, "I will build it, tell me when" | He has not said go. Promise still open |
| 3 | Opinion on the "AI Support for Book Publishing" recording | 13 Oct, "soon" | File received, 795 MB. See section 4 |
| 4 | N token, phase one | 10 Oct, "starting Monday" | Blocked: he has not chosen a path. See section 3 |
| 5 | Token scope document | 10 Oct, "tell me which path and I will send it" | Same block |
| 6 | Replace all 25 badges on the site, extend the album from 19 slots to 25, rebuild the sticker sheet | ongoing | Waiting on Sarah's redraw |

Item 1 is the oldest and the only one blocking the client. It should go first.

### Related code work that falls out of item 6

- `lib/gamification.ts:73` hardcodes `STICKER_SLOT_COUNT = 19`. It becomes 25.
- `lib/stickers.ts` needs six new entries, pages 20 to 25.
- `public/stickers/slot-01..19.png` get replaced, `slot-20..25.png` added.
- `public/stickers.pdf` is regenerated **at the same path**, because that address is printed in
  the Parent's Guide and must never change.

---

## 3. The New Hope coin, current state

Ray sent the design on 9 October. The outer ring reads **"NHC Decentralized Digital Currency"**,
which is both inaccurate (there is no chain, no network, no ledger) and the source of the risk.

On 10 October we put two paths to him and he has **not yet chosen**:

- **Path One**, a numbered sponsor recognition coin redeemable for books, with a public
  verification page. Legally a voucher. Buildable in days.
- **Path Two**, the fixed issue of 500,000 with an expectation of future value, which is what he
  described. Limited supply plus an expectation of profit from the issuer's efforts is the shape
  of a security, and that needs his lawyer **before** any coin is issued, not after.

A middle road was offered: build Path One now, and every coin issued can be honoured later if he
completes the legal work for Path Two. Starting safe costs nothing; starting the other way round
cannot be undone.

**Next action: a short reminder to him. He has not refused, he has been busy with Sarah and the
badges and it slipped.**

Also outstanding on the coin: the inscription pairs "In The Blessed Hope" (Titus 2:13) with a
Revelation 22:12 citation. Either correct the reference to Titus, or change the phrase to match
Revelation. He has not said which he prefers.

---

## 4. The 795 MB recording

`files from ray/141026/AI Support for Book Publishing.mov`, roughly 22 minutes. Ray copied it from
a broadcast, wants to know whether we think it has value, and says he would buy it and ask us to
manage it.

**How to review it cheaply.** Extracting frames is wasteful for a talk: 44 frames at one every
thirty seconds costs roughly 60,000 tokens and tells us almost nothing, because the content is
spoken rather than shown.

The cheap route is a transcript. `ffmpeg` is already on this machine, bundled with Playwright at
`%LOCALAPPDATA%\ms-playwright\ffmpeg-1011\ffmpeg-win64.exe`. Extract the audio, transcribe it
locally with `faster-whisper`, and read the text. A 22 minute talk is around 3,000 words, which is
roughly **5,000 tokens**. Transcription runs on this machine, so the client's file is never
uploaded anywhere.

If the transcript shows there were slides or a screen demo worth seeing, pull a handful of frames
at the timestamps that matter. Total stays under 16,000 tokens.

**The real question to answer for him is not whether the video is good.** It is what he would
actually be buying, and what "manage it" would mean in practice. The transcript is how we find out.

---

## 5. Still sitting with Ray

- **Video v5 is Private, not Unlisted.** Checked in a signed-out browser on 14 Oct:
  `youtu.be/YAURN0eL1xg` returns "This is a private video." Second time this has happened. He has
  been sent the fix: YouTube Studio, Content, the Visibility column, then **Save**.
- The real IngramSpark print cost. Still blocking the tier book counts, any affiliate rate, the
  Pay-It-Forward arithmetic and the premium price. He has emailed their support.
- Aymen's six pages, now largely moot since Sarah is redrawing the whole series.
- The jingle audio for the final page.
