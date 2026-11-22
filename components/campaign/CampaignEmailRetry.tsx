"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function CampaignEmailRetry({ voteId }: { voteId: string }) {
  const router = useRouter(); const waiting = useRef(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function retry() {
    if (waiting.current) return;
    waiting.current = true; setBusy(true); setMessage("");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch("/api/admin/campaign", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteId }), signal: controller.signal });
      const data = await response.json() as { error?: string; message?: string };
      setMessage(response.ok ? data.message ?? "Retry recorded." : data.error ?? "Please try again.");
      if (response.ok) router.refresh();
    } catch { setMessage("The retry status could not be checked. Reload the page before trying again."); }
    finally { clearTimeout(timer); waiting.current = false; setBusy(false); }
  }
  return <div><button onClick={retry} disabled={busy} className="btn-secondary min-h-11 text-sm">{busy ? "Checking..." : "Retry Unsent Email"}</button>
    {message && <p role="status" className="mt-2 text-sm text-ink-soft">{message}</p>}</div>;
}
