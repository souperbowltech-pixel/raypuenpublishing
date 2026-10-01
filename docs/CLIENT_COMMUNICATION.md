# Writing to the client

The client is **Ray Puen**, publisher, Puen Publishing. The channel is **Fiverr**. He is not
technical and has said so himself; he passes on what advisers give him without filtering it,
and he has asked to be told plainly when something he was handed is wrong.

This file is the rules and the facts. The conversation itself lives in a separate history file
(see **Where the history lives** at the end), and that file is the record of what has already
been said to him.

---

## 1. Nothing is ever sent

**Draft only.** Every message is handed to the operator, who reads it and sends it himself.
There is no exception to this and no message is "too small" to need it. The same applies to a
Fiverr delivery, a milestone note, or anything else that leaves this machine.

## 2. What the channel will and will not carry

- **Fiverr blocks any message containing an email address.** Never write one, not even the
  client's own, not even as an example. Say "your mailbox", "the live mailbox", "the address the
  guide goes to". This is the single most common reason a message fails to send.
- **No Google Drive or external file links.** Files go as attachments in the Fiverr thread. The
  client has been asked to attach covers directly and knows how; do not offer a Drive link as an
  alternative.
- **Plain text only.** No markdown tables, no `**bold**`, no backticks, no bullet characters
  other than a plain hyphen. He copies these messages into his own documents and markdown syntax
  arrives as literal junk. Numbered points and short paragraphs survive; anything clever does not.
- **Short.** He has said twice that replies were too long. Answer what he asked, in the order he
  asked it, and stop. If something important is outside what he asked, give it one short
  paragraph at the end, not three.
- **English.** Always, regardless of the language the operator is using.

## 3. The rule that matters more than the rest

**Verify every factual claim in the code or on the live site before writing it down.**

This project's recurring fault has a name: reporting success without checking. It has happened
at least five times, and twice it reached the client as a claim that something was live when it
was not. A message to Ray is the most expensive place for it to happen, because he acts on it -
he prints things, he mails things, he tells his own people.

Before any sentence that says a thing is live, done, included, or working:

- a price, a flag, a limit: read the constant in `lib/`
- a page or a link: `curl -s -o /dev/null -w "%{http_code}" <url>` against the live site
- a behaviour: find the test that covers it, or run it
- a file or an asset: look in `public/` and check its real dimensions, not its filename

If a claim cannot be verified, do not soften it - say in the draft that it is unverified, and
let the operator decide. "I have not confirmed this yet" is a perfectly good sentence to send him.

## 4. Correcting him

He has twice been given wrong information by other people and has asked to be told. When
something he has written or been handed is wrong:

- Say what is wrong in one sentence, with the number or the file that proves it.
- Say what is right.
- Give him the replacement wording, finished, so he does not have to work it out.
- Do not apologise on his behalf, do not lecture, and do not blame the adviser. He has already
  taken the blame himself; piling on is useless to him.

---

## 5. Standing facts. Check these before describing the product.

The product he describes in marketing copy and the product the code sells have drifted apart
before. These are the ones that matter, with where to verify each.

| What he may say | What is actually true | Where to check |
|---|---|---|
| The coloring book is $6.99 | Correct | `RETAIL_PRICE` in `lib/pricing.ts` |
| The $6.99 includes the Parent's Guide | **Wrong.** The Guide is not part of it | `lib/pricing.ts` |
| The digital Parent's Guide is $29.97 | Correct price, but **it cannot be sold** - the PDF does not exist and the checkout is deliberately closed | `PARENTS_GUIDE_DIGITAL_LIVE = false`, and the three reopening conditions in `lib/pricing.ts:13-28` |
| The $10 offer is three books | **Wrong.** It is three *gift memberships* to share | `app/guide/page.tsx:135-146` |
| Three friends registering earns the Guide free | Correct, and it is the **printed** Guide | `app/guide/page.tsx:146` |
| The gift codes are real | Correct - issued immediately when the $10 clears | `lib/patrol-store.ts` |
| There are five videos in the book | Correct - `/v1` to `/v5` are live | `lib/videos.ts`, `app/v1..v5` |
| The first video is ready | **No.** `/v1` shows its waiting screen until he supplies the YouTube Unlisted link. Swapping it in is one database row, no deploy, and no reprint | `lib/videos.ts`, `videos` table |
| We can show the Book 1 cover | **No.** The site still renders a placeholder | `public/placeholders/cover.svg` |
| The site address is the vercel.app one | **Never use it.** It answers, but it is the hosting platform's address. Always `puenpublishing.com` | `lib/site.ts`, and `lib/copy-hygiene.test.ts` fails if it returns to the code |
| Buyers get an email from us | **Not yet.** Email is built but unconfigured, so nothing sends | `emailConfigured()` in `lib/email.ts` |
| Payments are live | **No.** Stripe is in test mode, on hold by his own decision | `lib/stripe.ts`, and the tracker |
| Print fulfilment is IngramSpark | Correct, and Lulu is dead | his own directive, `RAY_DIRECTIVES_STATUS.md:56` |
| A book can be dispatched from the dashboard | **No.** Print fulfilment is flagged off and there is no dispatch route | `PRINT_FULFILLMENT_LIVE` in `lib/fulfillment.ts` |

When he describes something not in this table, add a row after verifying it. The table is only
useful if it stays true.

---

## 6. What he is still owed, and what he still owes

- What we are waiting on from him: `WAITING_ON_RAY.md`, one directory above the repository.
- What is left to build: `docs/BACKLOG.md`.
- What was promised to him and when: the history file below, and
  `RAY_CLIENT_COMMUNICATION_LOG.md` beside it.

Never tell him an item is finished without finding it in section E of `docs/BACKLOG.md` or
verifying it yourself. Section E is the only list that has been checked against the code.

---

## 7. How to answer a new message from him

1. Read the history file, from the end backwards, far enough to know what he was last told.
2. Read section 5 above and check every claim his message makes against it.
3. Verify anything his message asserts about the site. He is often repeating what somebody else
   told him, and that is exactly where the errors come from.
4. Write the draft: plain text, his numbering, short, no email address anywhere.
5. Hand it to the operator. Do not send it.
6. Append the message and the draft to the history file so the next person has it.

---

## Where the history lives

The full conversation is kept **outside this repository**, next to the other client files:

```
D:\fiverr client\Ray puens work\RAY_CLIENT_COMMUNICATION_LOG.md
D:\fiverr client\Ray puens work\CLIENT_CHAT_HISTORY.md      <- the full transcript
```

It is deliberately not in git. This repository is on GitHub, and the conversation contains the
client's business affairs - his finances, his family, his seminary schedule, his dealings with
other contractors. None of that belongs in a pushed commit. Keep it where it is, and keep this
file - which contains no client detail - in the repository where any agent can find it.
