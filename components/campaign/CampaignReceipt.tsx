"use client";
import { useEffect, useRef, useState } from "react";
import { campaignRequest, openCampaignDownload } from "@/lib/campaign-client";
import { RETAIL_PRICE, formatCurrency } from "@/lib/pricing";
import { publisherBrand } from "@/lib/book";

interface ReceiptView { title: string; message: string; character: string; canOrder: boolean; reservationTitle: string; quantity: number | null }
export function CampaignReceipt({ autoDownload = false }: { autoDownload?: boolean }) {
  const [receipt, setReceipt] = useState("");
  const [data, setData] = useState<ReceiptView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const waiting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const token = new URLSearchParams(window.location.hash.slice(1)).get("receipt") ?? "";
    setReceipt(token);
    if (!token || token.length > 160) { setError("Open the original private link from your kit email. If it has expired, contact Puen Publishing for help."); setLoading(false); return; }
    async function load() {
      try {
        if (autoDownload) {
          const result = await campaignRequest("kit", { receipt: token });
          if (active) openCampaignDownload(result.url);
        } else {
          const result = await campaignRequest("receipt", { receipt: token });
          if (typeof result.title !== "string" || typeof result.message !== "string" || typeof result.character !== "string"
            || typeof result.canOrder !== "boolean" || typeof result.reservationTitle !== "string"
            || (result.quantity !== null && typeof result.quantity !== "number")) throw new Error("Your saved request could not be opened. Please try again.");
          if (active) setData(result as unknown as ReceiptView);
        }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Please try again."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [autoDownload, loadAttempt]);
  useEffect(() => { if (data) heading.current?.focus(); }, [data]);
  async function download() {
    if (waiting.current) return;
    waiting.current = true; setBusy(true); setError("");
    try { const result = await campaignRequest("kit", { receipt }); openCampaignDownload(result.url); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { waiting.current = false; setBusy(false); }
  }
  async function reserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (waiting.current) return;
    const quantity = Number(new FormData(event.currentTarget).get("quantity"));
    waiting.current = true; setBusy(true); setError("");
    try {
      const result = await campaignRequest("reserve", { receipt, quantity });
      if (typeof result.quantity !== "number") throw new Error("Please reload to check your saved reservation.");
      setData((old) => old ? { ...old, quantity: result.quantity as number } : old);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { waiting.current = false; setBusy(false); }
  }
  return <section className="mx-auto max-w-2xl rounded-3xl border border-ink/15 bg-white p-6 shadow-card sm:p-10" aria-busy={loading || busy}>
    {loading && <p role="status" className="text-lg text-ink">{autoDownload ? "Opening your Starter Kit..." : "Opening your saved request..."}</p>}
    {data && <><h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-bold text-ink">{data.title}</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-soft">{data.message}</p>
      <p className="mt-5 text-ink-soft">Your free Starter Kit has three coloring pages and three matching Parent&apos;s Guide pages with badges. Print them and try an activity together.</p>
      <button onClick={download} disabled={busy} className="btn-primary mt-6 min-h-12 w-full">{busy ? "Please wait..." : "Download Your Free Starter Kit (PDF)"}</button>
      <p className="mt-3 text-sm text-ink-soft">You can use the kit here even if your requested backup email is delayed. Keep this private link for 30 days.</p>
      <div className="mt-8 border-t border-ink/15 pt-6">
        <h2 className="font-display text-xl font-bold text-ink">Continue with David and Goliath</h2>
        <p className="mt-2 text-ink-soft">The Neighborhood Chronicles, Book 1 is {formatCurrency(RETAIL_PRICE)}.</p>
        {data.canOrder ? <a href="/neighborhood#order" className="btn-primary mt-4 inline-flex min-h-12">Order Book 1</a>
          : data.quantity ? <p role="status" className="mt-4 rounded-xl bg-paper p-4 text-ink">Interest saved for {data.quantity} {data.quantity === 1 ? "copy" : "copies"}. This is not a payment or a confirmed delivery date.</p>
          : <form onSubmit={reserve} className="mt-4 space-y-3"><h3 className="font-semibold text-ink">{data.reservationTitle}</h3>
            <label htmlFor="reserve-quantity" className="block text-ink">Copies (1 to 10)</label>
            <input id="reserve-quantity" name="quantity" type="number" min={1} max={10} defaultValue={1} required className="input max-w-32" />
            <button disabled={busy} type="submit" className="btn-secondary min-h-12">Save My Interest</button>
            <p className="text-sm text-ink-soft">No payment is taken. Puen Publishing will contact you about availability. A reservation does not guarantee Christmas delivery.</p>
          </form>}
      </div></>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-paper p-4 font-semibold text-clay">{error}</p>}
    {!loading && !autoDownload && !data && receipt && <button onClick={() => setLoadAttempt((value) => value + 1)} className="btn-primary mt-4 min-h-12">Try Opening My Saved Request Again</button>}
    {error && <a href={`mailto:${publisherBrand.imprint.email}`} className="mt-4 inline-flex min-h-11 items-center text-ink underline">Contact Puen Publishing</a>}
    {!loading && autoDownload && receipt && <button disabled={busy} onClick={download} className="btn-primary mt-4 min-h-12">Try Download Again</button>}
    <a href="/welcome" className="mt-6 inline-flex min-h-11 items-center text-ink-soft underline">Back to the free Starter Kit page</a>
  </section>;
}
