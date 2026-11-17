import { supabase } from "@/lib/supabase";

export interface OrderRecord {
  stripeSessionId: string;
  orderType: string;
  customerEmail?: string | null;
  customerName?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  scoutToken?: string | null;
  metadata?: Record<string, unknown>;
}

export type RecordOrderResult =
  | { ok: true }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; error: string };

/**
 * Persist a paid order. Idempotent on stripe_session_id, so Stripe's webhook
 * retries never create duplicates. Returns `skipped` (not an error) when
 * Supabase isn't configured, e.g. local dev.
 */
export async function recordOrder(order: OrderRecord): Promise<RecordOrderResult> {
  if (!supabase) return { ok: false, skipped: true };

  const { error } = await supabase.from("orders").upsert(
    {
      stripe_session_id: order.stripeSessionId,
      order_type: order.orderType,
      customer_email: order.customerEmail ?? null,
      customer_name: order.customerName ?? null,
      amount_total: order.amountTotal ?? null,
      currency: order.currency ?? null,
      scout_token: order.scoutToken ?? null,
      metadata: order.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_session_id" }
  );

  if (error) return { ok: false, skipped: false, error: error.message };
  return { ok: true };
}

/** Best-effort status/error update once fulfilment steps have run. */
export async function markOrder(
  stripeSessionId: string,
  patch: { fulfillmentStatus?: "pending" | "fulfilled" | "failed"; lastError?: string | null }
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from("orders")
      .update({
        ...(patch.fulfillmentStatus && { fulfillment_status: patch.fulfillmentStatus }),
        ...(patch.lastError !== undefined && { last_error: patch.lastError }),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", stripeSessionId);
  } catch (err) {
    console.error("[Orders] Failed to update order status:", err);
  }
}

export type NoticeClaim = "claimed" | "already-sent" | "in-progress" | "unavailable";

/**
 * How long a claim holds before another delivery may take it. It must stay
 * well above one whole webhook run (record, claim, send, mark, alert and
 * MailerLite each allow up to about 8 s, so under a minute in all): a shorter
 * lease would let a second delivery send while the first is still sending.
 * Short enough that Stripe's next retry after a crashed run still sends.
 */
export const NOTICE_LEASE_MS = 10 * 60_000;

/**
 * Claim the right to email Ray about this order. Atomic: of two deliveries of
 * the same Stripe event, only one update finds the order unsent and unclaimed
 * (or holding a lapsed claim). The others learn why from the row:
 * "already-sent", "in-progress" (another delivery holds a live claim), or
 * "unavailable" (no database, migration 20261118 not run, no such row, or the
 * query failed); the caller decides what each means.
 */
export async function claimOrderNotice(stripeSessionId: string, now = new Date()): Promise<NoticeClaim> {
  if (!supabase) return "unavailable";
  try {
    const lapsed = new Date(now.getTime() - NOTICE_LEASE_MS).toISOString();
    const { data, error } = await supabase
      .from("orders")
      .update({ notice_claimed_at: now.toISOString() })
      .eq("stripe_session_id", stripeSessionId)
      .is("notice_sent_at", null)
      // Quoted: PostgREST reads "." and ":" in an unquoted value as syntax.
      .or(`notice_claimed_at.is.null,notice_claimed_at.lt."${lapsed}"`)
      .select("stripe_session_id");
    if (error) {
      console.error("[Orders] Could not claim the order notice:", error.code, error.message);
      return "unavailable";
    }
    if (data && data.length > 0) return "claimed";

    // Nothing was claimed: find out whether it was sent, is being sent, or is missing.
    const { data: row, error: readError } = await supabase
      .from("orders")
      .select("notice_sent_at")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();
    if (readError || !row) {
      if (readError) console.error("[Orders] Could not read the order notice:", readError.code, readError.message);
      return "unavailable";
    }
    return row.notice_sent_at ? "already-sent" : "in-progress";
  } catch (err) {
    console.error("[Orders] Could not claim the order notice:", err);
    return "unavailable";
  }
}

/**
 * Record that Ray's email was accepted, and clear any error an earlier failed
 * attempt left on the order. False if it could not be written: the email went,
 * but a later redelivery could send it again once the claim lapses.
 */
export async function markOrderNoticeSent(stripeSessionId: string, now = new Date()): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("orders")
      .update({ notice_sent_at: now.toISOString(), last_error: null, updated_at: now.toISOString() })
      .eq("stripe_session_id", stripeSessionId);
    if (error) console.error("[Orders] Could not record the order notice:", error.code, error.message);
    return !error;
  } catch (err) {
    console.error("[Orders] Could not record the order notice:", err);
    return false;
  }
}

/**
 * Give the claim back after a failed send, so Stripe's retry sends at once.
 * If this fails the claim still lapses after NOTICE_LEASE_MS, so the email is
 * delayed, never lost.
 */
export async function releaseOrderNotice(stripeSessionId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("orders")
      .update({ notice_claimed_at: null })
      .eq("stripe_session_id", stripeSessionId)
      .is("notice_sent_at", null);
    if (error) console.error("[Orders] Could not release the order notice:", error.code, error.message);
    return !error;
  } catch (err) {
    console.error("[Orders] Could not release the order notice:", err);
    return false;
  }
}
