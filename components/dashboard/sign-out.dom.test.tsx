// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Signing out of the Explorer dashboard. The page may only leave once the
 * server has cleared the session; if it cannot, the family is told and can try
 * again, rather than landing on /start still signed in.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// One router for the life of the page, as Next gives: the dashboard reloads whenever it changes.
const { replace, router } = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace, push: () => {}, refresh: () => {} } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const Book2Dashboard = (await import("@/app/dashboard/book2/page")).default;

let container: HTMLDivElement;
let root: Root;
let logout: () => Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === "/api/scout/state") return Promise.resolve(json({ scout: { scoutName: "Sam", shareCode: "ABC123" } }));
      if (url === "/api/family/logout") return logout();
      return new Promise(() => {}); // anything else the dashboard asks for stays pending
    })
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function openDashboard() {
  await act(async () => root.render(<Book2Dashboard />));
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Sign out")
  ) as HTMLButtonElement | undefined;
  if (!button) throw new Error("the signed-in family dashboard has no sign-out button");
  return button;
}

async function press(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("signing out", () => {
  it("shows that it is working, and leaves only once the server confirms", async () => {
    let finish!: (res: Response) => void;
    logout = () => new Promise((resolve) => (finish = resolve));
    const button = await openDashboard();

    await press(button);
    expect(button.disabled).toBe(true);
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
    expect(button.textContent).toContain("Signing out");
    expect(replace).not.toHaveBeenCalled();

    await act(async () => finish(json({ success: true })));
    expect(replace).toHaveBeenCalledWith("/start");
  });

  it.each([
    ["the network fails", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["the request times out", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
    ["the server errors", () => Promise.resolve(json({ error: "down" }, 500))],
  ])("stays, says so, and can be tried again when %s", async (_case, failure) => {
    logout = failure;
    const button = await openDashboard();

    await press(button);

    expect(replace).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not sign you out");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("Sign out");
  });
});
