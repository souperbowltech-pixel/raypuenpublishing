import { supabase, storageClient, usingServiceRole } from "@/lib/supabase";
import { stampPdf } from "@/lib/library-stamp";
import {
  canDownload,
  cleanRecipientName,
  codeExpiry,
  findBook,
  generateCode,
  hashCode,
  libraryConfigured,
  normalizeCode,
  stampText,
  COPY_CACHE_HOURS,
  REVIEW_DOWNLOAD_HOURS,
  SIGNED_URL_SECONDS,
  type GrantKind,
  type LibraryBook,
  type RefusalReason,
} from "@/lib/library";

/**
 * Where the library's codes are kept and its books handed over.
 *
 * A grant is one person's right to one book. Its code is shown once (to Ray, or
 * in the buyer's email) and only its keyed hash is stored. Opening a grant
 * stamps the person's name into a copy of the master, puts that copy in the
 * private bucket, and returns a link that works for a few minutes.
 *
 * Files cannot go back through the site's own functions (a response is capped
 * at about 4.5 MB), which is why the copy goes to storage and the browser is
 * sent there. Each grant has exactly one copy file, always under the same name,
 * so two clicks at once overwrite one file instead of leaving a stray one.
 */

export const LIBRARY_BUCKET = "library";
const HOUR = 60 * 60 * 1000;
/** A cached copy this close to its end is made again rather than handed out. */
const COPY_REUSE_MARGIN_MS = 10 * 60 * 1000;
/**
 * Copies are deleted an hour after the row stops reusing them, so a link handed
 * out in a copy's last minutes always finishes downloading. If a sweep does
 * catch a copy just made again, the next open finds it gone and stamps anew.
 */
const COPY_DELETE_AFTER_MS = (COPY_CACHE_HOURS + 1) * HOUR;
const SWEEP_BATCH = 100;
const SWEEP_TIMEOUT_MS = 5_000;

/**
 * The library needs the database, the storage client, the code secret and the
 * service-role key. With the public key instead, row security hides every grant
 * and every real code would be called invalid; better to say it is unavailable.
 */
function libraryReady(): boolean {
  return Boolean(supabase && storageClient && usingServiceRole && libraryConfigured());
}

/** The one storage name for a grant's stamped copy. */
export function copyPathFor(grantId: string): string {
  return `copies/${grantId}.pdf`;
}

export interface Grant {
  id: string;
  kind: GrantKind;
  bookSlug: string;
  recipientName: string;
  recipientEmail: string | null;
  emailSentAt: string | null;
  expiresAt: string;
  firstUsedAt: string | null;
  downloadUntil: string | null;
  copyPath: string | null;
  copyExpiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const COLUMNS =
  "id, kind, book_slug, recipient_name, recipient_email, email_sent_at, expires_at, first_used_at, download_until, copy_path, copy_expires_at, revoked_at, created_at";

type Row = Record<string, unknown>;

function toGrant(row: Row): Grant {
  return {
    id: String(row.id),
    kind: row.kind as GrantKind,
    bookSlug: String(row.book_slug),
    recipientName: String(row.recipient_name),
    recipientEmail: (row.recipient_email as string | null) ?? null,
    emailSentAt: (row.email_sent_at as string | null) ?? null,
    expiresAt: String(row.expires_at),
    firstUsedAt: (row.first_used_at as string | null) ?? null,
    downloadUntil: (row.download_until as string | null) ?? null,
    copyPath: (row.copy_path as string | null) ?? null,
    copyExpiresAt: (row.copy_expires_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

/** Postgres reports a broken unique rule with this code. */
const UNIQUE_VIOLATION = "23505";

export type CreateResult =
  | { ok: true; grant: Grant; code: string }
  | { ok: false; reason: "unavailable" | "invalid-name" | "unknown-book" | "duplicate" | "error" };

export interface CreateInput {
  kind: GrantKind;
  bookSlug: string;
  recipientName: unknown;
  recipientEmail?: string | null;
  stripeSessionId?: string | null;
  now?: Date;
}

/** A new grant, and its code in the clear. The caller shows or sends the code; it is not kept. */
export async function createGrant(input: CreateInput): Promise<CreateResult> {
  if (!supabase || !libraryReady()) return { ok: false, reason: "unavailable" };
  const book = findBook(input.bookSlug);
  if (!book) return { ok: false, reason: "unknown-book" };
  const name = cleanRecipientName(input.recipientName);
  if (!name) return { ok: false, reason: "invalid-name" };

  const now = input.now ?? new Date();
  const code = generateCode();
  const { data, error } = await supabase
    .from("library_grants")
    .insert({
      kind: input.kind,
      book_slug: book.slug,
      recipient_name: name,
      recipient_email: input.recipientEmail ?? null,
      stripe_session_id: input.stripeSessionId ?? null,
      code_hash: hashCode(code),
      expires_at: codeExpiry(input.kind, now).toISOString(),
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) return { ok: false, reason: "duplicate" };
    console.error("[library] grant insert failed", error?.code, error?.message);
    return { ok: false, reason: "error" };
  }
  return { ok: true, grant: toGrant(data as Row), code };
}


export type OpenResult =
  | { ok: true; url: string }
  | { ok: false; reason: "invalid" | RefusalReason | "unavailable" | "missing-master" | "error" };

async function grantByHash(hash: string): Promise<{ grant: Grant | null; failed: boolean }> {
  const { data, error } = await supabase!.from("library_grants").select(COLUMNS).eq("code_hash", hash).maybeSingle();
  if (error) {
    console.error("[library] grant lookup failed", error.code, error.message);
    return { grant: null, failed: true };
  }
  return { grant: data ? toGrant(data as Row) : null, failed: false };
}

/**
 * Open a typed code: check it, make the stamped copy, and only then record the
 * first use. A copy that could not be made therefore never spends a review
 * code; the person can simply try again.
 *
 * The first use is one conditional update, so two clicks at once cannot both
 * start a window: the loser reads the row again and is judged on what the
 * winner wrote. A grant already in use is read again after its copy is made,
 * so one Ray cancels during those seconds is refused too.
 */
export async function openCode(raw: unknown, now: Date = new Date()): Promise<OpenResult> {
  if (!supabase || !libraryReady()) return { ok: false, reason: "unavailable" };
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "invalid" };
  const hash = hashCode(code);

  const found = await grantByHash(hash);
  if (found.failed) return { ok: false, reason: "unavailable" };
  const grant = found.grant;
  if (!grant) return { ok: false, reason: "invalid" };
  const book = findBook(grant.bookSlug);
  if (!book) return { ok: false, reason: "invalid" };

  const allowed = canDownload(grant, now);
  if (!allowed.ok) return { ok: false, reason: allowed.reason };

  const link = await downloadLink(grant, book, now);
  if (!link.ok) return link;

  if (!grant.firstUsedAt) {
    const firstUse: Row = { first_used_at: now.toISOString() };
    if (grant.kind === "review") firstUse.download_until = new Date(now.getTime() + REVIEW_DOWNLOAD_HOURS * HOUR).toISOString();
    const { data, error } = await supabase
      .from("library_grants")
      .update(firstUse)
      .eq("id", grant.id)
      .is("first_used_at", null)
      .is("revoked_at", null)
      .select(COLUMNS);
    if (error) {
      console.error("[library] first use not recorded", error.code, error.message);
      return { ok: false, reason: "unavailable" };
    }
    if ((data as Row[] | null)?.[0]) return link;
  }

  // Already in use, or another click won the first use: judge the row as it is now.
  const again = await grantByHash(hash);
  if (again.failed || !again.grant) return { ok: false, reason: "unavailable" };
  const recheck = canDownload(again.grant, now);
  return recheck.ok ? link : { ok: false, reason: recheck.reason };
}

export type CopyResult = { ok: true; url: string } | { ok: false; reason: "missing-master" | "error" };

/**
 * A short-lived link to this person's stamped copy. A copy made in the last
 * hour is reused; otherwise, or when the cached file turns out to be gone, the
 * master is stamped again and written over the old copy. Old copies of every
 * grant are swept first, so the space a new copy needs is freed before it is used.
 */
export async function downloadLink(grant: Grant, book: LibraryBook, now: Date = new Date()): Promise<CopyResult> {
  if (!supabase || !storageClient) return { ok: false, reason: "error" };
  const bucket = storageClient.storage.from(LIBRARY_BUCKET);
  const path = copyPathFor(grant.id);
  const sign = () => bucket.createSignedUrl(path, SIGNED_URL_SECONDS, { download: book.fileName });

  const cachedUntil = grant.copyExpiresAt ? Date.parse(grant.copyExpiresAt) : NaN;
  const reusable =
    grant.copyPath === path && Number.isFinite(cachedUntil) && cachedUntil - now.getTime() > COPY_REUSE_MARGIN_MS;
  if (reusable) {
    const cached = await sign();
    if (!cached.error && cached.data?.signedUrl) return { ok: true, url: cached.data.signedUrl };
    // Swept a moment ago, or removed by hand: make it again rather than fail for the rest of the hour.
    console.error("[library] cached copy not available; stamping again", cached.error?.message);
  }

  // This grant's own file is about to be rewritten, so the sweep must never take it.
  await sweepOldCopies(now, path);

  const master = await bucket.download(book.masterPath);
  if (master.error || !master.data) {
    console.error("[library] master not available", book.masterPath, master.error?.message);
    return { ok: false, reason: "missing-master" };
  }

  let stamped: Uint8Array;
  try {
    const bytes = new Uint8Array(await master.data.arrayBuffer());
    stamped = await stampPdf(bytes, stampText(grant.kind, grant.recipientName));
  } catch (err) {
    console.error("[library] stamping failed", book.slug, err instanceof Error ? err.message : err);
    return { ok: false, reason: "error" };
  }

  const upload = await bucket.upload(path, stamped, { contentType: "application/pdf", upsert: true });
  if (upload.error) {
    // A full bucket shows up here first, and this log line names it.
    console.error("[library] copy upload failed", upload.error.message);
    return { ok: false, reason: "error" };
  }

  const { error } = await supabase
    .from("library_grants")
    .update({ copy_path: path, copy_expires_at: new Date(now.getTime() + COPY_CACHE_HOURS * HOUR).toISOString() })
    .eq("id", grant.id);
  // The copy still works for this click and is swept by age; it just will not be reused.
  if (error) console.error("[library] copy not recorded", error.code, error.message);

  const signed = await sign();
  if (signed.error || !signed.data?.signedUrl) {
    console.error("[library] signed link failed", signed.error?.message);
    return { ok: false, reason: "error" };
  }
  return { ok: true, url: signed.data.signedUrl };
}

/**
 * Delete stamped copies past their time, judged by the file's own age in
 * storage rather than by any row. A copy whose row was never written, or whose
 * request was cut short, is therefore swept like any other. It runs on the way
 * to a download, so it gets a few seconds and no more; whatever it misses, the
 * next sweep takes. Never throws; returns how many files were removed.
 */
export async function sweepOldCopies(now: Date = new Date(), keep?: string): Promise<number> {
  // A sweep that gave up keeps running in the background; this flag stops it deleting anything late.
  const run = { abandoned: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = new Promise<number>((resolve) => {
    timer = setTimeout(() => {
      run.abandoned = true;
      console.error("[library] sweep took too long; left for the next one");
      resolve(0);
    }, SWEEP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([sweep(now, keep, run), giveUp]);
  } finally {
    clearTimeout(timer);
  }
}

async function sweep(now: Date, keep: string | undefined, run: { abandoned: boolean }): Promise<number> {
  if (!storageClient) return 0;
  const bucket = storageClient.storage.from(LIBRARY_BUCKET);
  try {
    const { data, error } = await bucket.list("copies", {
      limit: SWEEP_BATCH,
      sortBy: { column: "updated_at", order: "asc" },
    });
    if (error || !data) {
      if (error) console.error("[library] sweep listing failed", error.message);
      return 0;
    }
    const cutoff = now.getTime() - COPY_DELETE_AFTER_MS;
    const old = data
      .filter((file) => {
        const touched = Date.parse(String(file.updated_at ?? file.created_at ?? ""));
        return file.name.endsWith(".pdf") && Number.isFinite(touched) && touched < cutoff;
      })
      .map((file) => `copies/${file.name}`)
      .filter((path) => path !== keep);
    if (old.length === 0 || run.abandoned) return 0;
    const removed = await bucket.remove(old);
    if (removed.error) {
      console.error("[library] sweep failed", removed.error.message);
      return 0;
    }
    return old.length;
  } catch (err) {
    console.error("[library] sweep threw", err instanceof Error ? err.message : err);
    return 0;
  }
}
