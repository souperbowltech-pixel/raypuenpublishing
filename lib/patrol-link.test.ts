import { describe, it, expect } from "vitest";
import { patrolTokenFrom } from "@/lib/patrol-link";

const token = "PT-abcDEF123_-xyz";
const link = `https://puenpublishing.com/dashboard/patrol?token=${token}`;

describe("patrolTokenFrom", () => {
  it("takes a bare token as it is", () => {
    expect(patrolTokenFrom(token)).toBe(token);
    expect(patrolTokenFrom(`  ${token}\n`)).toBe(token);
  });

  it("keeps a token that ends in - or _, which base64url allows", () => {
    expect(patrolTokenFrom("PT-abc-")).toBe("PT-abc-");
    expect(patrolTokenFrom(`${link}_`)).toBe(`${token}_`);
  });

  it("finds the token in the full link from the receipt", () => {
    expect(patrolTokenFrom(link)).toBe(token);
    expect(patrolTokenFrom(`puenpublishing.com/dashboard/patrol?token=${token}&utm=mail`)).toBe(token);
    expect(patrolTokenFrom(`puenpublishing.com/dashboard/patrol?utm=mail&token=${token}`)).toBe(token);
  });

  it.each([
    ["a full stop after the link", `${link}.`],
    ["a bracket after the link", `(${link})`],
    ["a comma after the link", `${link}, then`],
    ["words after the link", `Open ${link} to see your hub`],
    ["a new line and a sign-off", `link: ${link}\nThanks, Ray`],
    ["a fragment", `${link}#top`],
    ["a sentence around a bare token", `Your Patrol: ${token}. Keep it safe.`],
  ])("ignores %s", (_case, pasted) => {
    expect(patrolTokenFrom(pasted)).toBe(token);
  });

  it("reads a percent-encoded token from a link", () => {
    expect(patrolTokenFrom("https://puenpublishing.com/dashboard/patrol?token=PT%2Dabc")).toBe("PT-abc");
  });

  it("leaves anything else for the server to judge", () => {
    expect(patrolTokenFrom("not a token")).toBe("not a token");
    expect(patrolTokenFrom("")).toBe("");
    expect(patrolTokenFrom("https://example.com/?other=1")).toBe("https://example.com/?other=1");
  });
});
