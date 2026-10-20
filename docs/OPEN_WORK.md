# Open work and the Stripe go-live runbook

_Written 14 October 2026. This file is the short list of what is actually outstanding, plus the
exact steps for taking payments live. `docs/BACKLOG.md` covers audit findings; this file covers
what we owe the client and what the operator must do by hand._

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
