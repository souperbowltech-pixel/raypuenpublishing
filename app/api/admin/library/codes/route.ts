import type { NextRequest } from "next/server";
import { adminJson, readAdminJson } from "@/lib/admin-request";
import { createGrant, masterUploaded } from "@/lib/library-store";
import { cleanRecipientName, findBook, formatCode } from "@/lib/library";
import { normalizeEmail } from "@/lib/family";
import { getSiteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Ray makes a review code for one person and one book, from /admin.
 *
 * The code is in this answer and nowhere else: only its keyed hash is stored,
 * so Ray copies it from the screen and sends it himself. The answer also says
 * whether the book's file is uploaded yet, because a code for a book with no
 * file opens nothing.
 */
export async function POST(req: NextRequest) {
  const read = await readAdminJson(req, "admin-library-code");
  if (!read.ok) return read.response;
  const { body } = read;

  const book = findBook(body.book);
  if (!book) return adminJson({ error: "Please choose a book.", field: "book" }, 400);

  // Checked here as well as in createGrant, so a bad name is answered before the file check waits.
  if (!cleanRecipientName(body.name)) return adminJson({ error: "Please enter the person's name: letters, spaces and simple punctuation, up to 60 characters.", field: "name" }, 400);

  let recipientEmail: string | null = null;
  if (body.email !== undefined && body.email !== null && typeof body.email !== "string") {
    return adminJson({ error: "Please enter a valid email address, or leave it empty.", field: "email" }, 400);
  }
  if (typeof body.email === "string" && body.email.trim()) {
    const email = normalizeEmail(body.email);
    if (!email.ok) return adminJson({ error: "Please enter a valid email address, or leave it empty.", field: "email" }, 400);
    recipientEmail = email.value;
  }

  // Asked first, with its own deadline: once the grant exists its code must reach Ray.
  const bookUploaded = await masterUploaded(book);
  const created = await createGrant({ kind: "review", bookSlug: book.slug, recipientName: body.name, recipientEmail });
  if (!created.ok) {
    if (created.reason === "invalid-name") {
      return adminJson(
        { error: "Please enter the person's name: letters, spaces and simple punctuation, up to 60 characters.", field: "name" },
        400
      );
    }
    if (created.reason === "unavailable") {
      return adminJson({ error: "The library is not reachable right now. Please try again in a few minutes." }, 503);
    }
    return adminJson({ error: "The code could not be made. Please try again." }, 500);
  }

  return adminJson({
    code: formatCode(created.code),
    bookTitle: book.title,
    recipientName: created.grant.recipientName,
    expiresAt: created.grant.expiresAt,
    libraryUrl: `${getSiteOrigin()}/library`,
    bookUploaded,
  });
}
