import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The campaign retry worker runs from a Vercel cron. The project is on the free
 * (Hobby) plan, where a cron may run at most once a day, so the schedule must
 * stay daily or the deploy is refused. Vercel sends CRON_SECRET as the bearer
 * token, which is what app/api/campaign/worker checks.
 */

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "vercel.json"), "utf8")) as {
  crons?: { path: string; schedule: string }[];
};

describe("vercel.json crons", () => {
  it("runs the campaign retry worker", () => {
    expect(config.crons?.map((c) => c.path)).toContain("/api/campaign/worker");
    expect(fs.existsSync(path.resolve(__dirname, "..", "app/api/campaign/worker/route.ts"))).toBe(true);
  });

  it("runs each cron at most once a day, as the free plan requires", () => {
    for (const cron of config.crons ?? []) {
      const [minute, hour, ...rest] = cron.schedule.split(" ");
      expect(rest).toEqual(["*", "*", "*"]);
      expect(minute).toMatch(/^\d+$/);
      expect(hour).toMatch(/^\d+$/);
    }
  });
});
