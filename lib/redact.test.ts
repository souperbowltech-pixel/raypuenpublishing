import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { redactEmail, redactToken } from "@/lib/redact";

/**
 * Logs and alerts leave the building — an alert is POSTed to a chat webhook, a
 * log line sits in Vercel's history — so neither may carry a customer's address
 * or a scout token. The token is a credential: one alert in a chat channel would
 * hand it to everyone in that channel (AUDIT SEC-05).
 */

describe("redactEmail", () => {
  it("keeps the domain and hides the person", () => {
    expect(redactEmail("caroline@example.com")).toBe("c***@example.com");
  });

  it("never returns the address it was given", () => {
    for (const address of ["a@b.co", "someone.long@a-school.org", "x@y.z"]) {
      expect(redactEmail(address)).not.toBe(address);
    }
  });

  it("says so plainly for anything that is not an address", () => {
    expect(redactEmail("nonsense")).toBe("(invalid)");
    expect(redactEmail("@example.com")).toBe("(invalid)");
    expect(redactEmail("")).toBe("(none)");
    expect(redactEmail(undefined)).toBe("(none)");
    expect(redactEmail(null)).toBe("(none)");
    expect(redactEmail(42)).toBe("(none)");
  });
});

describe("redactToken", () => {
  it("leaves enough to find the row and far too little to use", () => {
    const token = "GG-ABCDEF-0123456789";
    const shown = redactToken(token);
    expect(shown.startsWith("GG-A")).toBe(true);
    expect(shown).not.toContain("BCDEF");
    expect(shown).toContain(String(token.length));
  });

  it("hides a short token completely rather than nearly all of it", () => {
    expect(redactToken("abcd")).toBe("****");
    expect(redactToken("ab")).toBe("****");
  });

  it("handles nothing at all", () => {
    expect(redactToken("")).toBe("(none)");
    expect(redactToken(undefined)).toBe("(none)");
  });
});

describe("the webhook does not write personal data anywhere it can leak", () => {
  const route = fs.readFileSync(
    path.join(path.resolve(__dirname, ".."), "app/api/webhooks/stripe/route.ts"),
    "utf8"
  );

  const alertBlocks = () => {
    const blocks: string[] = [];
    let i = 0;
    for (;;) {
      const start = route.indexOf("alertFailure(", i);
      if (start === -1) return blocks;
      let k = start + "alertFailure(".length;
      let depth = 1;
      while (k < route.length && depth) {
        if (route[k] === "(") depth += 1;
        else if (route[k] === ")") depth -= 1;
        k += 1;
      }
      blocks.push(route.slice(start, k));
      i = k;
    }
  };

  it("sends no raw email address to an alert", () => {
    for (const block of alertBlocks()) {
      expect(block).not.toMatch(/email:\s*customerEmail\b/);
    }
  });

  it("sends no raw scout token to an alert", () => {
    for (const block of alertBlocks()) {
      expect(block).not.toMatch(/scoutToken:\s*grandpaToken\b/);
    }
  });

  it("logs no raw email address or token", () => {
    const logs = route.match(/console\.(log|error|warn)\([^;]*/g) || [];
    for (const line of logs) {
      expect(line).not.toMatch(/\$\{customerEmail\}/);
      expect(line).not.toMatch(/\$\{grandpaToken\}/);
      expect(line).not.toMatch(/\$\{patrol\.token\}/);
    }
  });

  it("still stores the real values where they are needed", () => {
    // recordOrder writes the order row, and MailerLite is handed the actual
    // subscriber: redacting either would break the thing it is there to do.
    expect(route).toMatch(/scoutToken:\s*grandpaToken,/);
    expect(route).toMatch(/addSubscriberToMailerLite\(\{[\s\S]*?email:\s*customerEmail,/);
  });
});
