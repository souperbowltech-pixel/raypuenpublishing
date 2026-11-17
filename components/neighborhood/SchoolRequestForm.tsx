"use client";

import React, { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { SCHOOL_REQUEST_LIMITS, type SchoolRequestField } from "@/lib/school-requests";
import { timeoutSignal } from "@/lib/timeout-signal";

type Fields = Record<SchoolRequestField, string>;

const EMPTY: Fields = { name: "", role: "", school: "", location: "", email: "", phone: "", copies: "", message: "" };
const FIELD_KEYS = Object.keys(EMPTY) as SchoolRequestField[];

/**
 * Checked here only so an empty form is answered at once, in the order the
 * server checks them. The server stays the judge of everything else.
 */
const REQUIRED: [SchoolRequestField, string][] = [
  ["name", "Please enter your name."],
  ["role", "Please enter your role."],
  ["school", "Please enter the name of your school or group."],
  ["location", "Please enter your city and state."],
  ["email", "Please enter your email address."],
];

/**
 * The server saves the row, then emails Ray (lib/email.ts allows 8 s), so a
 * slow answer may still be a saved request. Past this, the leader is told it
 * may have arrived rather than invited to send a duplicate.
 */
const SUBMIT_TIMEOUT_MS = 30_000;

type FormError = { field: SchoolRequestField | null; message: string };

/**
 * The request form at the foot of /neighborhood. It posts to /api/school-request,
 * which validates, saves the row for Ray and emails him. Errors are shown under
 * the field they name, and focus goes there.
 */
export function SchoolRequestForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  // The honeypot: hidden from people, filled in by bots.
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  // State updates land after a re-render; the ref stops a second submit at once.
  const sending = useRef(false);
  const thanks = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (error?.field) document.getElementById(`sr-${error.field}`)?.focus();
  }, [error]);

  useEffect(() => {
    if (sent) thanks.current?.focus();
  }, [sent]);

  const set = (field: SchoolRequestField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending.current) return;

    const missing = REQUIRED.find(([field]) => !fields[field].trim());
    if (missing) {
      setError({ field: missing[0], message: missing[1] });
      return;
    }

    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, website }),
        signal: timeoutSignal(SUBMIT_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown; field?: unknown };
      if (res.ok) {
        setSent(true);
        return;
      }
      const field = FIELD_KEYS.find((key) => key === data.field) ?? null;
      const message = typeof data.error === "string" && data.error ? data.error : "We could not send your request. Please try again.";
      setError({ field, message });
    } catch (err) {
      const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
      setError({
        field: null,
        message: timedOut
          ? "This is taking longer than usual, and your request may already have arrived. Please wait a few minutes before sending it again."
          : "We could not reach the server. Please check your connection and try again.",
      });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="animate-rise rounded-3xl border-2 border-spruce/30 bg-spruce/10 p-6 text-center sm:p-8">
        <h3 ref={thanks} tabIndex={-1} className="font-display text-2xl font-bold text-ink focus:outline-none">
          Thank you, your request is on its way.
        </h3>
        <p className="mt-3 text-ink-soft">Ray Puen will reply to you personally at the email address you gave.</p>
      </div>
    );
  }

  const labelClass = "mb-1 block text-xs font-bold uppercase tracking-wider text-ink-soft";
  const star = <span aria-hidden="true"> *</span>;
  const errorProps = (field: SchoolRequestField) =>
    error?.field === field ? { "aria-invalid": true as const, "aria-describedby": `sr-${field}-error` } : {};
  const fieldError = (field: SchoolRequestField) =>
    error?.field === field ? (
      <p id={`sr-${field}-error`} className="mt-1 text-sm font-semibold text-clay-dark">
        {error.message}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <p className="text-sm text-ink-soft">Fields marked * are required.</p>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-bold text-ink">About you</legend>
        <div>
          <label htmlFor="sr-name" className={labelClass}>Your name{star}</label>
          <input id="sr-name" type="text" required autoComplete="name" maxLength={SCHOOL_REQUEST_LIMITS.name}
            value={fields.name} onChange={set("name")} {...errorProps("name")} className="input text-sm" />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="sr-role" className={labelClass}>Your role{star}</label>
          <input id="sr-role" type="text" required autoComplete="organization-title" maxLength={SCHOOL_REQUEST_LIMITS.role}
            value={fields.role} onChange={set("role")} {...errorProps("role")} className="input text-sm"
            placeholder="e.g. Co-op coordinator" />
          {fieldError("role")}
        </div>
        <div>
          <label htmlFor="sr-school" className={labelClass}>Co-op, association or school{star}</label>
          <input id="sr-school" type="text" required autoComplete="organization" maxLength={SCHOOL_REQUEST_LIMITS.school}
            value={fields.school} onChange={set("school")} {...errorProps("school")} className="input text-sm" />
          {fieldError("school")}
        </div>
        <div>
          <label htmlFor="sr-location" className={labelClass}>City and state{star}</label>
          <input id="sr-location" type="text" required maxLength={SCHOOL_REQUEST_LIMITS.location}
            value={fields.location} onChange={set("location")} {...errorProps("location")} className="input text-sm" />
          {fieldError("location")}
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-bold text-ink">How to reach you</legend>
        <div>
          <label htmlFor="sr-email" className={labelClass}>Email{star}</label>
          <input id="sr-email" type="email" required autoComplete="email"
            value={fields.email} onChange={set("email")} {...errorProps("email")} className="input text-sm" />
          {fieldError("email")}
        </div>
        <div>
          <label htmlFor="sr-phone" className={labelClass}>Phone (optional)</label>
          <input id="sr-phone" type="tel" autoComplete="tel" maxLength={SCHOOL_REQUEST_LIMITS.phone}
            value={fields.phone} onChange={set("phone")} {...errorProps("phone")} className="input text-sm" />
          {fieldError("phone")}
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4">
        <legend className="mb-3 font-display text-lg font-bold text-ink">Your request</legend>
        <div>
          <label htmlFor="sr-copies" className={labelClass}>Number of copies you have in mind (optional)</label>
          <input id="sr-copies" type="text" inputMode="numeric"
            value={fields.copies} onChange={set("copies")} {...errorProps("copies")} className="input text-sm sm:max-w-xs" />
          {fieldError("copies")}
        </div>
        <div>
          <label htmlFor="sr-message" className={labelClass}>Anything you would like to ask (optional)</label>
          <textarea id="sr-message" rows={4} maxLength={SCHOOL_REQUEST_LIMITS.message}
            value={fields.message} onChange={set("message")} {...errorProps("message")} className="input text-sm" />
          {fieldError("message")}
        </div>
      </fieldset>

      {/* Password managers fill every box they can see; the ignore marks keep them off this one. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="sr-website">Leave this empty</label>
        <input id="sr-website" type="text" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore="true"
          value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className={error.field === null
          ? "rounded-xl border border-clay/30 bg-clay/10 p-4 text-center text-sm font-bold text-clay-dark"
          : "sr-only"}>
          {error.message}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-base">
        {busy ? <><Spinner className="h-4 w-4" /> Sending your request</> : "Send my request"}
      </button>
    </form>
  );
}
