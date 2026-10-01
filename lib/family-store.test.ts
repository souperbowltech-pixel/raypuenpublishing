import { describe, it, expect, beforeEach, vi } from "vitest";

const alertFailureMock = vi.fn();
vi.mock("@/lib/alerts", () => ({
  alertFailure: (...args: unknown[]) => alertFailureMock(...args),
}));

const env = vi.hoisted(() => ({
  supabase: null as unknown,
  isProduction: false,
}));

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return env.supabase;
  },
  get isProduction() {
    return env.isProduction;
  },
}));

const { getFamilySession, registerFamily } = await import("./family-store");

describe("family-store error alerting (OPS-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.supabase = null;
    env.isProduction = false;
  });

  it("calls alertFailure when family_sessions lookup has a database error", async () => {
    const fakeClient = {
      from: (table: string) => {
        if (table === "family_sessions") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { message: "connection timeout", code: "57014" },
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    env.supabase = fakeClient;

    const session = await getFamilySession("test_session_token");
    expect(session).toBeNull();
    expect(alertFailureMock).toHaveBeenCalledWith(
      "Family session lookup failed",
      { error: "connection timeout" }
    );
  });

  it("calls alertFailure when scout_profiles lookup has a database error", async () => {
    const fakeClient = {
      from: (table: string) => {
        if (table === "family_sessions") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { family_id: "fam_1", families: { parent_email: "parent@example.com" } },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "scout_profiles") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: null,
                      error: { message: "scout table missing", code: "42P01" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    env.supabase = fakeClient;

    const session = await getFamilySession("test_session_token");
    expect(session).toBeNull();
    expect(alertFailureMock).toHaveBeenCalledWith(
      "Family scout lookup failed",
      { error: "scout table missing" }
    );
  });

  it("returns family session when database lookup succeeds without alerting", async () => {
    const fakeClient = {
      from: (table: string) => {
        if (table === "family_sessions") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { family_id: "fam_1", families: { parent_email: "parent@example.com" } },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "scout_profiles") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: {
                        token: "scout_token_123",
                        share_code: "GG-234567",
                        scout_name: "Timmy",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    env.supabase = fakeClient;

    const session = await getFamilySession("test_session_token");
    expect(session).toEqual({
      familyId: "fam_1",
      parentEmail: "parent@example.com",
      scoutToken: "scout_token_123",
      shareCode: "GG-234567",
      firstName: "Timmy",
    });
    expect(alertFailureMock).not.toHaveBeenCalled();
  });
});
