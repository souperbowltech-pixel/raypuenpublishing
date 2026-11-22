"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CHARACTERS, CHARACTER_NAMES, campaignSource, validateVote, type Character } from "@/lib/campaign";
import { CHARACTER_DESCRIPTIONS, VOTE_QUESTION, optionalQuestion } from "@/lib/campaign-content";
import { campaignRequest, newCampaignSubmissionId, CampaignRequestError } from "@/lib/campaign-client";

export function VoteForm() {
  const router = useRouter();
  const [character, setCharacter] = useState<Character | "">("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const waiting = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  function fail(message: string, field?: string) {
    setError({ message, field });
    if (field) formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (waiting.current) return;
    const form = new FormData(event.currentTarget);
    const raw = { character, firstName: form.get("firstName"), email: form.get("email"), answer: form.get("answer"),
      phone: form.get("phone"), adultConsent: form.has("adultConsent"), marketingConsent: form.has("marketingConsent"),
      smsConsent: form.has("smsConsent"), source: campaignSource(new URLSearchParams(window.location.search).get("ref")) };
    const key = JSON.stringify(raw);
    const submissionId = attempt.current?.key === key ? attempt.current.id : newCampaignSubmissionId();
    const parsed = validateVote({ ...raw, submissionId });
    if (!parsed.ok) { fail(parsed.error, parsed.field); return; }
    waiting.current = true; setBusy(true); setError(null); setNotice("");
    attempt.current = { key, id: submissionId };
    try {
      const result = await campaignRequest("vote", { ...parsed.value, adultConsent: true, website: form.get("website") });
      if (typeof result.receipt === "string") router.push(`/welcome/thanks#receipt=${encodeURIComponent(result.receipt)}`);
      else if (typeof result.message === "string") setNotice(result.message);
      else fail("We could not open your kit. Please try again.");
    } catch (caught) {
      const e = caught instanceof CampaignRequestError ? caught : new CampaignRequestError("Please try again.");
      // Only our own known fields become a selector; a server message cannot select arbitrary DOM.
      const field = ["character", "firstName", "email", "answer", "phone", "adultConsent", "smsConsent", "marketingConsent"].includes(e.field ?? "") ? e.field : undefined;
      fail(e.message, field);
    } finally { waiting.current = false; setBusy(false); }
  }
  const invalid = (field: string) => error?.field === field ? { "aria-invalid": true as const, "aria-describedby": `vote-${field}-error` } : {};
  const fieldError = (field: string) => error?.field === field ? <p id={`vote-${field}-error`} className="mt-1 text-sm font-semibold text-clay">{error.message}</p> : null;
  return <section id="vote" className="rounded-3xl border border-ink/15 bg-white p-5 shadow-card sm:p-8">
    <h2 className="font-display text-2xl font-bold text-ink">Your Child&apos;s Neighborhood Watch Vote</h2>
    <p className="mt-3 text-ink-soft">Ask your child, then complete this form as their parent or adult caregiver.</p>
    <form ref={formRef} onSubmit={submit} noValidate className="mt-6 space-y-6" aria-busy={busy}>
      <fieldset {...invalid("character")}>
        <legend className="mb-3 font-semibold text-ink">{VOTE_QUESTION}</legend>
        <div className="space-y-3">{CHARACTERS.map((value) => <label key={value} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${character === value ? "border-crayon-gold bg-paper" : "border-ink/15"}`}>
          <input className="mt-1 h-5 w-5 shrink-0 accent-clay" type="radio" name="character" value={value} checked={character === value} onChange={() => setCharacter(value)} />
          <span><span className="block font-bold text-ink">{CHARACTER_NAMES[value]}</span><span className="text-base text-ink-soft">{CHARACTER_DESCRIPTIONS[value]}</span></span>
        </label>)}</div>{fieldError("character")}
      </fieldset>
      <div><label htmlFor="vote-answer" className="block font-semibold text-ink">{optionalQuestion(character)} <span className="font-normal">(optional)</span></label>
        <textarea id="vote-answer" name="answer" maxLength={500} rows={3} className="input mt-2" {...invalid("answer")} />{fieldError("answer")}</div>
      <div><label htmlFor="vote-firstName" className="block font-semibold text-ink">Parent&apos;s first name</label>
        <input id="vote-firstName" name="firstName" autoComplete="given-name" maxLength={50} className="input mt-2" required {...invalid("firstName")} />{fieldError("firstName")}</div>
      <div><label htmlFor="vote-email" className="block font-semibold text-ink">Parent&apos;s email address</label>
        <input id="vote-email" name="email" type="email" autoComplete="email" maxLength={254} className="input mt-2" required {...invalid("email")} />{fieldError("email")}
        <p className="mt-2 text-sm text-ink-soft">We use this address to send your private Starter Kit backup.</p></div>
      <div><label htmlFor="vote-phone" className="block font-semibold text-ink">Mobile phone number (optional)</label>
        <input id="vote-phone" name="phone" type="tel" autoComplete="tel" placeholder="+15551234567" maxLength={16} className="input mt-2" {...invalid("phone")} />{fieldError("phone")}
        <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-ink"><input type="checkbox" name="smsConsent" className="mt-1 h-5 w-5 shrink-0" {...invalid("smsConsent")} />You may contact me by text about this request. Optional; leave the phone number empty if you do not agree.</label>{fieldError("smsConsent")}</div>
      <label className="flex min-h-11 items-start gap-3 text-base text-ink"><input type="checkbox" name="adultConsent" className="mt-1 h-5 w-5 shrink-0" required {...invalid("adultConsent")} />I am a parent or adult caregiver requesting this kit for my family.</label>{fieldError("adultConsent")}
      <label className="flex min-h-11 items-start gap-3 text-sm text-ink"><input type="checkbox" name="marketingConsent" className="mt-1 h-5 w-5 shrink-0" {...invalid("marketingConsent")} />Email me occasional family activities and book news. Optional; the free kit does not depend on this choice.</label>{fieldError("marketingConsent")}
      <div className="hidden" aria-hidden="true"><label htmlFor="vote-website">Leave empty</label><input id="vote-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p role="alert" className="rounded-xl bg-paper p-3 font-semibold text-clay">{error.message}</p>}
      {notice && <p role="status" className="rounded-xl bg-paper p-3 text-ink">{notice}</p>}
      <button type="submit" disabled={busy} className="btn-primary min-h-12 w-full">{busy ? "Saving your request..." : "Unlock My Child's Free Starter Kit"}</button>
      <p className="text-sm text-ink-soft">No purchase needed. Six printable pages: three coloring activities and three matching Parent&apos;s Guide pages with badges. Please enter adult details only.</p>
    </form>
  </section>;
}
