import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminCookieValue, isAdminKey } from "@/lib/admin-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Signing in to the admin view.
 *
 * The key is posted in a form body and exchanged for an httpOnly cookie, so it
 * never travels in a URL where it would end up in browser history, a referrer
 * header or a server log.
 */
export async function POST(req: NextRequest) {
  // Signing out, for a shared machine. A form can only POST, so it arrives here.
  if (new URL(req.url).searchParams.get("signout")) {
    const out = NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
    out.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return out;
  }

  // Ten tries a minute makes guessing pointless without locking Ray out.
  // Signing in needs no database, so a slow Supabase must not lock Ray out: if the
  // shared count cannot be checked, this instance holds sign-in to 3 tries a minute.
  const limit = await rateLimit(`admin-session:${clientIp(req)}`, 10, 60_000, { whenUnavailable: 3 });
  if (!limit.ok) {
    return NextResponse.redirect(new URL("/admin?error=rate", req.url), { status: 303 });
  }

  const form = await req.formData();
  if (!isAdminKey(form.get("key"))) {
    return NextResponse.redirect(new URL("/admin?error=1", req.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
  response.cookies.set(ADMIN_COOKIE, adminCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return response;
}
