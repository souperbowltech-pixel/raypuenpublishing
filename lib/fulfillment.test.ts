import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  dispatchPrintOrder,
  PRINT_FULFILLMENT_LIVE,
  DISPATCH_ENDPOINT,
  type ShippingAddress,
} from "@/lib/fulfillment";

/**
 * FE-05 — the dashboard can claim a book was dispatched when nothing was sent.
 *
 * The one rule: a book counts as dispatched only when the printer returns an
 * order reference. Every other outcome — closed, unconfigured, network down,
 * 500, timeout, or a 200 with an empty reference — must come back as
 * `dispatched: false` with a reason the caller can act on.
 */

const address: ShippingAddress = {
  recipient: "Parent Name",
  addressLine1: "123 Main St",
  city: "Anytown",
  state: "IL",
  zip: "61801",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("dispatchPrintOrder", () => {
  it("closed (live: false): returns reason 'not-open' and never calls fetch", async () => {
    const result = await dispatchPrintOrder(address, 2, {
      live: false,
      endpoint: "https://printer.test/orders",
    });
    expect(result).toMatchObject({
      dispatched: false,
      reason: "not-open",
      message: "Printing is not open yet. Nothing was sent.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no endpoint even when live: returns reason 'not-open' and never calls fetch", async () => {
    const result = await dispatchPrintOrder(address, 2, {
      live: true,
      endpoint: null,
    });
    expect(result).toMatchObject({
      dispatched: false,
      reason: "not-open",
      message: "Printing is not open yet. Nothing was sent.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults to the module flags which are safely closed", async () => {
    expect(PRINT_FULFILLMENT_LIVE).toBe(false);
    expect(DISPATCH_ENDPOINT).toBeNull();
    const result = await dispatchPrintOrder(address, 2);
    expect(result).toMatchObject({
      dispatched: false,
      reason: "not-open",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("open, 200 with a reference: dispatched true, reference carried through", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reference: "ING-12345" }),
    });
    const result = await dispatchPrintOrder(address, 2, {
      live: true,
      endpoint: "https://printer.test/orders",
    });
    expect(result).toEqual({
      dispatched: true,
      reference: "ING-12345",
    });
  });

  it("open, 200 with no reference / an empty reference: dispatched false, 'rejected'", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const resultNoRef = await dispatchPrintOrder(address, 2, {
      live: true,
      endpoint: "https://printer.test/orders",
    });
    expect(resultNoRef).toMatchObject({
      dispatched: false,
      reason: "rejected",
      message: "The printer returned no order reference.",
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reference: "   " }),
    });
    const resultEmptyRef = await dispatchPrintOrder(address, 2, {
      live: true,
      endpoint: "https://printer.test/orders",
    });
    expect(resultEmptyRef).toMatchObject({
      dispatched: false,
      reason: "rejected",
      message: "The printer returned no order reference.",
    });
  });

  it("open, 500: dispatched false, 'rejected'", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });
    const result = await dispatchPrintOrder(address, 2, {
      live: true,
      endpoint: "https://printer.test/orders",
    });
    expect(result).toMatchObject({
      dispatched: false,
      reason: "rejected",
      message: "HTTP 500",
    });
  });

  it("open, fetch throws: dispatched false, 'error'", async () => {
    fetchMock.mockRejectedValue(new Error("Network connection lost"));
    const result = await dispatchPrintOrder(address, 2, {
      live: true,
      endpoint: "https://printer.test/orders",
    });
    expect(result).toMatchObject({
      dispatched: false,
      reason: "error",
      message: "Network connection lost",
    });
  });

  it("open, the request never settles: the abort fires and the result is 'timeout'", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: unknown, init: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        capturedSignal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const promise = dispatchPrintOrder(address, 2, {
      live: true,
      endpoint: "https://printer.test/orders",
    });
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(capturedSignal!.aborted).toBe(true);
    expect(result).toMatchObject({
      dispatched: false,
      reason: "timeout",
    });
  });

  it("the request carries the address and cache: 'no-store'", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reference: "ING-999" }),
    });
    await dispatchPrintOrder(address, 3, {
      live: true,
      endpoint: "https://printer.test/orders",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://printer.test/orders");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ address, bookNumber: 3 });
  });
});
