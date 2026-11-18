import { LIBRARY_BOOKS, findBook, grantStatus } from "@/lib/library";
import { GRANTS_PAGE_SIZE, type Grant } from "@/lib/library-store";
import { pageCursor } from "@/lib/page-cursor";
import type { LibraryBookOption, LibraryCodeRow } from "@/components/admin/LibraryCodes";

/**
 * What the review-code section of /admin is given. Worked out on the server,
 * so the client component never imports the code rules (they read the code
 * secret) and receives plain rows with no hash, code or email in them. Kept in
 * lib/, never imported by a "use client" file.
 */

export const libraryBookOptions = (): LibraryBookOption[] => LIBRARY_BOOKS.map(({ slug, title }) => ({ slug, title }));

export function libraryCodeRows(grants: Grant[] | null, now: Date): LibraryCodeRow[] | null {
  if (grants === null) return null;
  return grants.map((grant) => ({
    id: grant.id,
    bookTitle: findBook(grant.bookSlug)?.title ?? grant.bookSlug,
    recipientName: grant.recipientName,
    kind: grant.kind,
    status: grantStatus(grant, now),
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
  }));
}

/** Where the next page of codes starts, when this page is full. */
export function olderCodesCursor(grants: Grant[] | null): string | null {
  return grants && grants.length === GRANTS_PAGE_SIZE ? pageCursor(grants[grants.length - 1]) : null;
}
