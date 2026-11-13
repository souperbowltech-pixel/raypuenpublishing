import { supabase } from "@/lib/supabase";
import { sendEmail, emailConfigured, redactEmail, type EmailResult } from "@/lib/email";
import { approvalRecipient } from "@/lib/notifications";
import type { SchoolRequestInput } from "@/lib/school-requests";

/**
 * Where a school's request is kept, and how Ray hears about it.
 *
 * The row in public.school_requests is the request. The email to Ray is a
 * courtesy on top: it is only sent when Resend is configured, and a failed send
 * never loses the request, because /admin lists every row.
 */

export interface SchoolRequestRow extends SchoolRequestInput {
  id: string;
  createdAt: string;
}

export type SaveResult = { ok: true; id: string } | { ok: false; reason: "unavailable" | "error" };

export async function saveSchoolRequest(input: SchoolRequestInput): Promise<SaveResult> {
  if (!supabase) {
    console.error("[school-requests] no database configured; request not saved");
    return { ok: false, reason: "unavailable" };
  }

  const { data, error } = await supabase
    .from("school_requests")
    .insert({
      name: input.name,
      role: input.role,
      school: input.school,
      location: input.location,
      email: input.email,
      phone: input.phone,
      copies: input.copies,
      message: input.message,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[school-requests] insert failed", error?.code, error?.message);
    return { ok: false, reason: "error" };
  }
  return { ok: true, id: data.id as string };
}

/** One admin page of requests. Ray reads these by eye, so 50 is plenty. */
export const SCHOOL_REQUESTS_PAGE_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres timestamptz as PostgREST returns it, kept as text so no microsecond is lost. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Where the next page starts: the last row's time and id. Two requests can share
 * a time, so the id breaks the tie and none is skipped or shown twice.
 */
export function pageCursor(row: Pick<SchoolRequestRow, "createdAt" | "id">): string {
  return `${row.createdAt}|${row.id}`;
}

/** A cursor that came back through a URL. Anything malformed means "first page". */
export function parsePageCursor(raw: unknown): { createdAt: string; id: string } | null {
  if (typeof raw !== "string") return null;
  const [createdAt, id, extra] = raw.split("|");
  if (extra !== undefined || !TIMESTAMP.test(createdAt ?? "") || !UUID.test(id ?? "")) return null;
  return { createdAt, id };
}

/**
 * Newest first, one page at a time. Returns null when the list cannot be read,
 * so the page can say so instead of showing an empty list.
 */
export async function listSchoolRequests(cursor?: string): Promise<SchoolRequestRow[] | null> {
  if (!supabase) return null;

  let query = supabase
    .from("school_requests")
    .select("id, name, role, school, location, email, phone, copies, message, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SCHOOL_REQUESTS_PAGE_SIZE);

  const after = parsePageCursor(cursor);
  if (after) {
    // Both values passed the strict patterns above, so they cannot break out of the filter.
    query = query.or(
      `created_at.lt.${after.createdAt},and(created_at.eq.${after.createdAt},id.lt.${after.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[school-requests] list failed", error.code, error.message);
    return null;
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    school: row.school,
    location: row.location,
    email: row.email,
    phone: row.phone,
    copies: row.copies,
    message: row.message,
    createdAt: row.created_at,
  }));
}

/** Plain text, because the person reading it is Ray, on whatever mail app he uses. */
export function schoolRequestEmailText(input: SchoolRequestInput): string {
  return [
    "A school has asked about The Neighborhood Chronicles.",
    "",
    `Name: ${input.name}`,
    `Role: ${input.role}`,
    `School: ${input.school}`,
    `City and state: ${input.location}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone ?? "not given"}`,
    `Copies: ${input.copies ?? "not given"}`,
    "",
    "Message:",
    input.message ?? "(none)",
    "",
    "Reply to this email to answer them directly. Every request is also listed on the admin page.",
  ].join("\n");
}

/**
 * Tell Ray. Returns the send result unchanged; the caller only logs it, because
 * the saved row is what matters.
 */
export async function notifySchoolRequest(input: SchoolRequestInput): Promise<EmailResult> {
  if (!emailConfigured()) return { sent: false, reason: "not-configured" };
  const result = await sendEmail({
    to: approvalRecipient(),
    subject: `School request: ${input.school}`,
    text: schoolRequestEmailText(input),
    replyTo: input.email,
    // EMAIL_FROM names the children's Chief Explorer; a principal's request is business mail.
    fromName: "Puen Publishing",
  });
  if (!result.sent) {
    console.warn("[school-requests] notification not sent", result.reason, redactEmail(input.email));
  }
  return result;
}
