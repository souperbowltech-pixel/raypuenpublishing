/**
 * One-to-one print fulfillment for unlocked books.
 *
 * Automatic print-and-ship is switched on once IngramSpark is connected. Until
 * then the card never collects an address it can't use or claims a dispatch
 * that didn't happen: it tells the family the free book is reserved.
 *
 * The rule this module exists to keep: never report a book as dispatched
 * unless the printer accepted it and returned an order reference. Three separate
 * faults in this project have been some version of "reported success without
 * asking", and a dispatch confirmation for a book that was never sent is the
 * same fault wearing a different hat.
 */

/** Flipped on only when a real dispatch route exists to go with it. */
export const PRINT_FULFILLMENT_LIVE = false;

/**
 * The route that will really hand the order to the printer. Null because it does
 * not exist yet.
 */
export const DISPATCH_ENDPOINT: string | null = null;

export interface ShippingAddress {
  recipient: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}

export type DispatchOutcome =
  | { dispatched: true; reference: string }
  | {
      dispatched: false;
      reason: "not-open" | "rejected" | "error" | "timeout";
      message: string;
    };

const TIMEOUT_MS = 10_000;

/**
 * Dispatch a print-and-ship order for an unlocked free book.
 *
 * The `target` parameter exists so the closed state and the open state can
 * both be tested.
 */
export async function dispatchPrintOrder(
  address: ShippingAddress,
  bookNumber: 2 | 3,
  target: { live: boolean; endpoint: string | null } = {
    live: PRINT_FULFILLMENT_LIVE,
    endpoint: DISPATCH_ENDPOINT,
  }
): Promise<DispatchOutcome> {
  if (!target.live || !target.endpoint) {
    return {
      dispatched: false,
      reason: "not-open",
      message: "Printing is not open yet. Nothing was sent.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address, bookNumber }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        dispatched: false,
        reason: "rejected",
        message: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { reference?: unknown };
    if (typeof data?.reference !== "string" || data.reference.trim() === "") {
      // A 200 with no reference is not a dispatch. Treat it as a failure, not a success.
      return {
        dispatched: false,
        reason: "rejected",
        message: "The printer returned no order reference.",
      };
    }

    return {
      dispatched: true,
      reference: data.reference,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      dispatched: false,
      reason: aborted ? "timeout" : "error",
      message: aborted
        ? `timed out after ${TIMEOUT_MS}ms`
        : err instanceof Error
        ? err.message
        : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
