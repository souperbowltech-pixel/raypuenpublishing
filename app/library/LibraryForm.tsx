"use client";

import { useEffect, useState } from "react";
import { codeFromFragment, isSafeDownloadUrl } from "@/lib/library-link";

/**
 * The code field. A link like /library#code=ABCD-2345-WXYZ fills it in: the
 * part after # never leaves the browser, so the code stays out of server logs
 * and out of the address another site sees.
 */
export function LibraryForm() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromLink = codeFromFragment(window.location.hash);
    if (fromLink) {
      setCode(fromLink);
      // Take the code back out of the address bar, so it is not left in history or a shared screen.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("working");
    setError(null);
    try {
      const res = await fetch("/api/library/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "We could not prepare your copy right now. Please try again in a few minutes.");
        setState("idle");
        return;
      }
      if (!isSafeDownloadUrl(data.url)) {
        setError("Your copy is ready, but the download link looked wrong. Please let us know so we can fix it.");
        setState("idle");
        return;
      }
      setState("done");
      window.location.assign(data.url);
    } catch {
      setError("We could not reach the site. Please check your connection and try again.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <label htmlFor="code" className="block text-sm font-bold text-ink">
        Your code
      </label>
      <input
        id="code"
        name="code"
        className="input font-mono uppercase tracking-widest"
        placeholder="ABCD-2345-WXYZ"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={64}
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <button type="submit" className="btn-primary w-full" disabled={state === "working" || !code.trim()}>
        {state === "working" ? "Preparing your copy..." : "Download my copy"}
      </button>
      {state === "done" && (
        <p className="text-sm font-semibold text-spruce-dark" role="status">
          Your download is starting. If nothing happens, press the button again.
        </p>
      )}
      {error && (
        <p className="text-sm font-semibold text-clay" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
