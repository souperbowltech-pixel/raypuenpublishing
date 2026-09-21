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
