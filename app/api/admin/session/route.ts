import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminCookieValue, isAdminKey, revokeAdminCookie } from "@/lib/admin-auth";
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
    if (!await revokeAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
      return new NextResponse("Sign-out could not be saved. Please return to /admin and try again.", {
        status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const out = NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
    out.headers.set("Cache-Control", "no-store");
    out.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return out;
  }

  // Ten tries a minute makes guessing pointless without locking Ray out.
  // If the shared count cannot be checked, this instance holds sign-in to 3 tries
  // a minute. Saving the revocable session below still requires the shared store.
  const limit = await rateLimit(`admin-session:${clientIp(req)}`, 10, 60_000, { whenUnavailable: 3 });
  if (!limit.ok) {
    return NextResponse.redirect(new URL("/admin?error=rate", req.url), { status: 303 });
  }

  const form = await req.formData();
  if (!isAdminKey(form.get("key"))) {
    return NextResponse.redirect(new URL("/admin?error=1", req.url), { status: 303 });
  }

  let value: string;
  try {
    value = await adminCookieValue();
  } catch {
    return new NextResponse("Admin sessions are temporarily unavailable. Please return to /admin and try again.", {
      status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const response = NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(ADMIN_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return response;
}
