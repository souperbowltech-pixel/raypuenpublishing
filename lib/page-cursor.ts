/**
 * Where the next page of a newest-first list starts: the last row's time and
 * id. Two rows can share a time, so the id breaks the tie and none is skipped
 * or shown twice. Shared by the lists on /admin.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres timestamptz as PostgREST returns it, kept as text so no microsecond is lost. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export function pageCursor(row: { createdAt: string; id: string }): string {
  return `${row.createdAt}|${row.id}`;
}

/** A cursor that came back through a URL. Anything malformed means "first page". */
export function parsePageCursor(raw: unknown): { createdAt: string; id: string } | null {
  if (typeof raw !== "string") return null;
  const [createdAt, id, extra] = raw.split("|");
  if (extra !== undefined || !TIMESTAMP.test(createdAt ?? "") || !UUID.test(id ?? "")) return null;
  return { createdAt, id };
}
