import type { NextRequest } from "next/server";
import { adminJson, readAdminJson } from "@/lib/admin-request";
import { revokeGrant } from "@/lib/library-store";

export const dynamic = "force-dynamic";

/**
 * Ray cancels a review code from /admin. A code already cancelled, never there,
 * or belonging to a paid buyer (never cancelled from here) answers 404; the
 * page then shows the list as it is now.
 */
export async function POST(req: NextRequest) {
  const read = await readAdminJson(req, "admin-library-cancel");
  if (!read.ok) return read.response;

  const result = await revokeGrant(read.body.id);
  if (result === "unavailable") {
    return adminJson({ error: "The library is not reachable right now. Please try again in a few minutes." }, 503);
  }
  if (result === "not-found") {
    return adminJson({ error: "That code was not found, or it was already cancelled." }, 404);
  }
  return adminJson({ cancelled: true });
}
