/** AbortSignal.timeout, with a fallback for browsers before it (iPads on iOS 15 and older). */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("The request timed out.", "TimeoutError")), ms);
  return controller.signal;
}
