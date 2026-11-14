// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Ticking stickers quickly. Seen on the live demo dashboard on 15 Nov: three
 * quick ticks, then two of them switched themselves off a moment later and
 * came back after a reload. Each tick sends the whole list, and every reply
 * used to overwrite the screen, so a slow early reply wiped later ticks (and
 * the save that reached the server last decided what was kept).
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { router } = vi.hoisted(() => ({ router: { replace: () => {}, push: () => {}, refresh: () => {} } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));

const Book2Dashboard = (await import("@/app/dashboard/book2/page")).default;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Saves the test answers by hand, in whatever order it likes. */
let saves: { body: Record<string, unknown>; pages: number[]; reply: (ok?: boolean, extra?: Record<string, unknown>) => void }[] = [];
let started = 0;
let lastSaved: number[] = [];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  saves = [];
  started = 0;
  lastSaved = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/scout/state")) return Promise.resolve(json({ scout: { scoutName: "Sam", completedPages: [] } }));
      if (url === "/api/scout/update") {
        started++;
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const pages = (body.completedPages as number[] | undefined) ?? lastSaved;
        return new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")));
          saves.push({
            body,
            pages,
            reply: (ok = true, extra = {}) => {
              if (ok) lastSaved = pages;
              resolve(ok ? json({ saved: true, scout: { completedPages: pages, ...extra } }) : json({ saved: false }, 503));
            },
          });
        });
      }
      return new Promise(() => {});
    })
  );
  window.history.replaceState(null, "", "/dashboard/book2");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const toggle = (page: number) =>
  Array.from(container.querySelectorAll("button[aria-pressed]")).find((b) =>
    b.textContent?.includes(`page ${page},`)
  ) as HTMLButtonElement;
const ticked = (page: number) => toggle(page).getAttribute("aria-pressed") === "true";
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

async function open() {
  await act(async () => root.render(<Book2Dashboard />));
  await flush();
}

describe("ticking stickers quickly", () => {
  it("keeps every tick on screen even when an early save answers last", async () => {
    await open();
    for (const page of [1, 2, 3]) {
      await act(async () => toggle(page).click());
    }
    expect([ticked(1), ticked(2), ticked(3)]).toEqual([true, true, true]);

    // Answer whatever has been sent, newest first, until every save is done.
    for (let round = 0; round < 5 && saves.length; round++) {
      const pending = saves.splice(0);
      for (const save of pending.reverse()) {
        await act(async () => save.reply());
        await flush();
      }
    }

    expect([ticked(1), ticked(2), ticked(3)]).toEqual([true, true, true]);
  });

  it("sends one save at a time, the last one carrying every tick", async () => {
    await open();
    for (const page of [1, 2, 3]) {
      await act(async () => toggle(page).click());
    }
    expect(started).toBe(1); // the others wait their turn, so they cannot overtake it at the server

    let last: number[] = [];
    while (saves.length) {
      const save = saves.shift()!;
      last = save.pages;
      await act(async () => save.reply());
      await flush();
    }
    expect(last).toEqual([1, 2, 3]);
  });

  it("still puts a tick back when its own save fails and nothing newer is waiting", async () => {
    await open();
    await act(async () => toggle(4).click());
    expect(ticked(4)).toBe(true);
    await act(async () => saves.shift()!.reply(false));
    await flush();
    expect(ticked(4)).toBe(false);
  });

  it("keeps both ticks when an older save fails but a newer one carrying it succeeds", async () => {
    await open();
    await act(async () => toggle(1).click());
    await act(async () => toggle(2).click());
    await act(async () => saves.shift()!.reply(false));
    await flush();
    await act(async () => saves.shift()!.reply());
    await flush();
    expect([ticked(1), ticked(2)]).toEqual([true, true]);
    expect(container.querySelector('[role="alert"]')).toBeNull(); // the newest save confirmed everything
  });

  it("undoes only the newest tick when it fails after an older one was saved, and says so", async () => {
    await open();
    await act(async () => toggle(1).click());
    await act(async () => toggle(2).click());
    await act(async () => saves.shift()!.reply());
    await flush();
    await act(async () => saves.shift()!.reply(false));
    await flush();
    expect([ticked(1), ticked(2)]).toEqual([true, false]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("didn");
  });

  it("shows the points from a confirmed save even when the save after it fails", async () => {
    await open();
    await act(async () => toggle(1).click());
    await act(async () => toggle(2).click());
    await act(async () => saves.shift()!.reply(true, { quizScore: 400 }));
    await flush();
    await act(async () => saves.shift()!.reply(false));
    await flush();
    expect(container.textContent).toContain("400/ 700");
  });

  it("does not let one stalled save hold every later one", async () => {
    const aborters: AbortController[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      aborters.push(controller);
      return controller.signal;
    });
    await open();
    await act(async () => toggle(1).click());
    await act(async () => toggle(2).click());
    expect(started).toBe(1);

    await act(async () => aborters[0].abort()); // the first save never answers and times out
    await flush();
    expect(started).toBe(2);
    await act(async () => saves[1].reply());
    await flush();
    expect([ticked(1), ticked(2)]).toEqual([true, true]);
    expect(container.textContent).not.toContain("Syncing...");
  });

  it("saves the name once typing pauses, not on every key", async () => {
    await open();
    vi.useFakeTimers();
    const name = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    for (const value of ["S", "Sa", "Sam", "Samm"]) {
      act(() => {
        setter.call(name, value);
        name.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => vi.advanceTimersByTime(200));
    }
    expect(started).toBe(0);
    await act(async () => vi.advanceTimersByTime(600));
    expect(started).toBe(1);
    expect(saves[0].body.scoutName).toBe("Samm");
    vi.useRealTimers();
  });

  it("sends the demo token with every queued save on the demo profile", async () => {
    window.history.replaceState(null, "", "/dashboard/book2?demo=1");
    await open();
    await act(async () => toggle(1).click());
    await act(async () => toggle(2).click());
    await act(async () => saves.shift()!.reply());
    await flush();
    expect(saves[0].body.token).toBe("CAPTAIN-RAY-700");
  });

  it("turns every unsaved tick back off when quick saves all fail, as when offline", async () => {
    await open();
    await act(async () => toggle(1).click());
    await act(async () => toggle(2).click());
    await act(async () => saves.shift()!.reply(false));
    await flush();
    await act(async () => saves.shift()!.reply(false));
    await flush();
    expect([ticked(1), ticked(2)]).toEqual([false, false]); // nothing was ever recorded
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("still saves a name typed just before leaving the page", async () => {
    await open();
    vi.useFakeTimers();
    const name = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(name, "Samira");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => vi.advanceTimersByTime(100));
    act(() => root.unmount());
    await act(async () => {
      await Promise.resolve();
    });
    expect(saves.at(-1)?.body.scoutName).toBe("Samira");
    root = createRoot(container);
  });
});
