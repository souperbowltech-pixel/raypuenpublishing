import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminConfigured, isAdminCookie } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * The checks every JSON action on /admin goes through, in one place: admin
 * key configured, a valid admin cookie, a JSON body (a plain cross-site form
 * cannot send one, and the cookie is SameSite=Lax as well), and a rate limit
 * that refuses when it cannot count. Answers are never cached.
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function adminJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export type AdminBody = { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse };

export async function readAdminJson(req: NextRequest, limitKey: string): Promise<AdminBody> {
  if (!adminConfigured() || !isAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return { ok: false, response: adminJson({ error: "Please sign in to the admin page again." }, 401) };
  }
  const mediaType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, response: adminJson({ error: "Invalid request." }, 415) };
  }

  const limit = await rateLimit(`${limitKey}:${clientIp(req)}`, 30, 60_000, { whenUnavailable: "refuse" });
  if (!limit.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many attempts. Please wait a minute." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfter) } }
      ),
    };
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: adminJson({ error: "Invalid request." }, 400) };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, response: adminJson({ error: "Invalid request." }, 400) };
  }
  return { ok: true, body: body as Record<string, unknown> };
}
