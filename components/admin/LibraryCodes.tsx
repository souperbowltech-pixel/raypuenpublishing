"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";

export interface LibraryBookOption {
  slug: string;
  title: string;
}

export interface LibraryCodeRow {
  id: string;
  bookTitle: string;
  recipientName: string;
  kind: "review" | "purchase";
  status: "unused" | "open" | "used" | "expired" | "cancelled";
  createdAt: string;
  expiresAt: string;
}

interface Made {
  code: string;
  bookTitle: string;
  recipientName: string;
  expiresAt: string;
  libraryUrl: string;
  bookUploaded: boolean | null;
}

type Field = "book" | "name" | "email";

const STATUS_TEXT: Record<LibraryCodeRow["status"], string> = {
  unused: "Not opened yet",
  open: "Opened, download window open",
  used: "Used",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** Dates as Ray reads them, in UTC like the rest of /admin. */
const DAY = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
function day(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DAY.format(date);
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

/**
 * Review codes on /admin: Ray makes one for a person and a book, sees it once
 * with a ready link to send, and can cancel any code in the list below.
 */
export function LibraryCodes({
  books,
  rows,
  olderCursor = null,
  paged = false,
}: {
  books: LibraryBookOption[];
  rows: LibraryCodeRow[] | null;
  /** Set when this page is full: where the older codes start. */
  olderCursor?: string | null;
  /** True on an older page, to offer the way back. */
  paged?: boolean;
}) {
  const router = useRouter();
  const [book, setBook] = useState(books[0]?.slug ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: Field | null; message: string } | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const sending = useRef(false);

  async function make(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    if (!name.trim()) {
      setError({ field: "name", message: "Please enter the person's name." });
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    setMade(null);
    setCopied("no");
    try {
      const { ok, data } = await postJson("/api/admin/library/codes", { book, name, email });
      if (ok && typeof data.code === "string" && typeof data.libraryUrl === "string") {
        setMade({
          code: data.code,
          libraryUrl: data.libraryUrl,
          bookTitle: String(data.bookTitle ?? ""),
          recipientName: String(data.recipientName ?? ""),
          expiresAt: String(data.expiresAt ?? ""),
          bookUploaded: typeof data.bookUploaded === "boolean" ? data.bookUploaded : null,
        });
        setName("");
        setEmail("");
        router.refresh();
      } else {
        const field = data.field === "book" || data.field === "name" || data.field === "email" ? data.field : null;
        setError({ field, message: typeof data.error === "string" ? data.error : "The code could not be made. Please try again." });
      }
    } catch {
      setError({ field: null, message: "Could not reach the site. Please check the connection and try again." });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function cancel(row: LibraryCodeRow) {
    const question = `Cancel the code for ${row.recipientName}? It will not open the book again. A copy already downloaded cannot be taken back.`;
    if (!window.confirm(question)) return;
    setCancelling(row.id);
    setListError(null);
    try {
      const { ok, status, data } = await postJson("/api/admin/library/codes/cancel", { id: row.id });
      if (!ok) setListError(typeof data.error === "string" ? data.error : "The code could not be cancelled. Please try again.");
      // Cancelled, or already cancelled elsewhere: either way the list should show it as it is now.
      if (ok || status === 404) router.refresh();
    } catch {
      setListError("Could not reach the site. Please check the connection and try again.");
    } finally {
      setCancelling(null);
    }
  }

  const shareLink = made ? `${made.libraryUrl}#code=${encodeURIComponent(made.code)}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  const labelClass = "mb-1 block text-xs font-bold uppercase tracking-wider text-ink-soft";
  const invalid = (field: Field) =>
    error?.field === field ? { "aria-invalid": true as const, "aria-describedby": "lc-error" } : {};

  return (
    <section aria-labelledby="library-codes" className="mt-12">
      <h2 id="library-codes" className="font-display text-2xl font-bold text-ink">
        Review copies
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Make a code for one person and one book. It opens once, and every page of their copy carries their name.
      </p>

      <form onSubmit={make} noValidate className="mt-6 grid gap-4 rounded-2xl border border-ink/10 bg-paper-deep p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="lc-book" className={labelClass}>Book</label>
          <select id="lc-book" value={book} onChange={(e) => setBook(e.target.value)} {...invalid("book")} className="input min-h-11 text-sm">
            {books.map((b) => (
              <option key={b.slug} value={b.slug}>{b.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lc-name" className={labelClass}>Their name (printed on the copy)</label>
          <input id="lc-name" type="text" maxLength={60} autoComplete="off" value={name}
            onChange={(e) => setName(e.target.value)} {...invalid("name")} className="input min-h-11 text-sm" />
        </div>
        <div>
          <label htmlFor="lc-email" className={labelClass}>Their email (optional, for your records)</label>
          <input id="lc-email" type="email" autoComplete="off" value={email}
            onChange={(e) => setEmail(e.target.value)} {...invalid("email")} className="input min-h-11 text-sm" />
        </div>
        {error && (
          <p id="lc-error" role="alert" className="sm:col-span-2 text-sm font-semibold text-clay-dark">{error.message}</p>
        )}
        <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
          {busy ? <><Spinner className="h-4 w-4" /> Making the code</> : "Make a review code"}
        </button>
      </form>

      {made && (
        <div role="status" className="mt-6 rounded-2xl border-2 border-spruce/40 bg-spruce/10 p-5">
          <p className="font-bold text-ink">Code for {made.recipientName}: {made.bookTitle}</p>
          <p className="mt-3 select-all font-mono text-2xl font-bold tracking-widest text-ink">{made.code}</p>
          <p className="mt-2 text-sm text-ink-soft">
            Shown only now: copy it before you leave this page. Opens until {day(made.expiresAt)}.
          </p>
          <p className="mt-3 break-all text-sm text-ink">{shareLink}</p>
          <button type="button" onClick={copy} className="btn-secondary mt-3">
            {copied === "yes" ? "Link copied" : "Copy the link to send"}
          </button>
          {copied === "failed" && (
            <p className="mt-2 text-sm font-semibold text-clay-dark">Could not copy. Please select the link above and copy it.</p>
          )}
          {made.bookUploaded === false && (
            <p className="mt-3 rounded-lg bg-clay/10 p-3 text-sm font-semibold text-clay-dark">
              This book&apos;s file is not uploaded yet, so the code will not open anything until it is.
            </p>
          )}
          {made.bookUploaded === null && (
            <p className="mt-3 text-sm text-ink-soft">Could not check whether this book&apos;s file is uploaded.</p>
          )}
        </div>
      )}

      {listError && (
        <p role="alert" className="mt-6 rounded-xl border border-clay/30 bg-clay/10 p-4 text-sm font-bold text-clay-dark">{listError}</p>
      )}

      {rows === null ? (
        <p role="alert" className="mt-6 rounded-xl border border-clay/30 bg-clay/10 p-5 font-semibold text-clay-dark">
          The codes could not be loaded just now. Please reload the page in a minute.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-ink/5 p-5 text-ink-soft">{paged ? "There are no older codes." : "No codes yet."}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-paper-deep p-4">
              <div>
                <p className="font-bold text-ink">{row.recipientName}</p>
                <p className="text-sm text-ink-soft">
                  {row.bookTitle}, {row.kind === "purchase" ? "paid copy" : "review copy"}
                </p>
                <p className="text-sm text-ink-soft">
                  {STATUS_TEXT[row.status]}. Made {day(row.createdAt)}, opens until {day(row.expiresAt)}.
                </p>
              </div>
              {/* Review codes only: a paid buyer's code cannot be given back from here. */}
              {row.kind === "review" && (row.status === "unused" || row.status === "open") && (
                <button type="button" onClick={() => cancel(row)} disabled={cancelling === row.id}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-clay-dark underline">
                  {cancelling === row.id ? "Cancelling" : "Cancel code"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {(paged || olderCursor) && (
        <nav aria-label="More codes" className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
          {paged && (
            <a href="/admin#library-codes" className="inline-flex min-h-11 items-center underline">Back to the newest</a>
          )}
          {olderCursor && (
            <a href={`/admin?lbefore=${encodeURIComponent(olderCursor)}#library-codes`} className="inline-flex min-h-11 items-center underline">
              Older codes
            </a>
          )}
        </nav>
      )}
    </section>
  );
}
