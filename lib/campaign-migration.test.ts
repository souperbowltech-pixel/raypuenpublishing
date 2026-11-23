import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The campaign migration is run by hand in the Supabase SQL editor, so nothing
 * else notices when the file is damaged. It was once committed holding only a
 * stray "b1"; these checks make sure it still creates everything the code calls.
 */

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261122_create_campaign.sql"), "utf8");

describe("campaign migration", () => {
  it("runs as one transaction", () => {
    expect(sql).toMatch(/^begin;$/m);
    expect(sql.trimEnd()).toMatch(/commit;$/);
  });

  it.each(["campaign_votes", "campaign_outbox"])("creates the %s table with row level security", (table) => {
    expect(sql).toContain(`create table public.${table} (`);
    expect(sql).toContain(`alter table public.${table} enable row level security;`);
  });

  it.each([
    "submit_campaign_vote",
    "reserve_campaign_copy",
    "claim_campaign_messages",
    "finish_campaign_message",
    "campaign_summary",
    "campaign_readiness",
  ])("creates %s and lets only service_role run it", (fn) => {
    expect(sql).toContain(`create function public.${fn}(`);
    const revoke = sql.slice(sql.indexOf("revoke all on function"), sql.indexOf("grant execute on function"));
    expect(revoke).toContain(`public.${fn}(`);
    expect(revoke).toContain("from public,anon,authenticated;");
    const grant = sql.slice(sql.indexOf("grant execute on function"));
    expect(grant).toContain(`public.${fn}(`);
    expect(grant).toContain("to service_role;");
  });

  it("keeps the tables away from anonymous and signed-in browsers", () => {
    expect(sql).toContain("revoke all on public.campaign_votes, public.campaign_outbox from anon, authenticated;");
  });

  it("never runs a campaign function with elevated privileges", () => {
    expect(sql.toLowerCase()).not.toContain("security definer");
  });
});
