import { supabase, storageClient, usingServiceRole } from "@/lib/supabase";
import { campaignConfigured, voteFingerprint, makeReceipt } from "@/lib/campaign-token";
import { isCharacter, UUID_PATTERN, KIT_URL_SECONDS, type VoteInput, type Character } from "@/lib/campaign";
import { parsePageCursor } from "@/lib/page-cursor";

export const CAMPAIGN_BUCKET = "library";
export const CAMPAIGN_KIT_PATH = "campaign/starter-kit.pdf";
export const CAMPAIGN_PAGE_SIZE = 50;
function db() { return supabase && usingServiceRole ? supabase : null; }
type JsonRecord = Record<string, unknown>;
function record(raw: unknown): JsonRecord | null {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw as JsonRecord : null;
}
/** Fail closed on missing schema, service role, private bucket or actual kit file. */
export async function campaignReady(): Promise<boolean> {
  const client = db();
  if (!client || !storageClient || !campaignConfigured()) return false;
  try {
    const [schema, bucket, files] = await Promise.all([
      client.rpc("campaign_readiness"), storageClient.storage.getBucket(CAMPAIGN_BUCKET),
      storageClient.storage.from(CAMPAIGN_BUCKET).list("campaign", { search: "starter-kit.pdf", limit: 10 }),
    ]);
    return schema.error === null && schema.data === true && !bucket.error && bucket.data?.public === false
      && !files.error && Boolean(files.data?.some((file) => file.name === "starter-kit.pdf"));
  } catch { console.error("[campaign] readiness check failed"); return false; }
}
export type SaveVote = { status: "saved" | "replay"; id: string; createdAt: string; receipt: string }
  | { status: "duplicate" | "conflict" | "unavailable" };
export async function saveVote(input: VoteInput): Promise<SaveVote> {
  const client = db();
  if (!client || !campaignConfigured()) return { status: "unavailable" };
  try {
    const { data, error } = await client.rpc("submit_campaign_vote", { p_input: input, p_fingerprint: voteFingerprint(input) });
    const row = record(data);
    if (error || !row) return { status: "unavailable" };
    if (row.status === "duplicate" || row.status === "conflict") return { status: row.status };
    if ((row.status !== "saved" && row.status !== "replay") || typeof row.id !== "string" || typeof row.createdAt !== "string") return { status: "unavailable" };
    const receipt = makeReceipt(row.id, row.createdAt);
    return receipt ? { status: row.status, id: row.id, createdAt: row.createdAt, receipt } : { status: "unavailable" };
  } catch { console.error("[campaign] vote save failed"); return { status: "unavailable" }; }
}
export interface CampaignVote {
  id: string; createdAt: string; character: Character; firstName: string; email: string;
  source: string; phone: string | null; answer: string | null; marketingConsent: boolean;
  smsConsent: boolean; quantity: number | null; revoked: boolean;
}
function voteRow(raw: unknown): CampaignVote | null {
  const r = record(raw);
  if (!r || typeof r.id !== "string" || !UUID_PATTERN.test(r.id) || !isCharacter(r.character)
    || typeof r.created_at !== "string" || typeof r.email !== "string" || typeof r.first_name !== "string") return null;
  return { id: r.id, createdAt: r.created_at, character: r.character, firstName: r.first_name, email: r.email,
    source: String(r.source), phone: typeof r.phone === "string" ? r.phone : null,
    answer: typeof r.answer === "string" ? r.answer : null, marketingConsent: r.marketing_consent === true,
    smsConsent: r.sms_consent === true, quantity: typeof r.reserved_quantity === "number" ? r.reserved_quantity : null,
    revoked: r.revoked_at != null };
}
export async function getCampaignVote(id: string): Promise<CampaignVote | null> {
  const client = db();
  if (!client || !UUID_PATTERN.test(id)) return null;
  try {
    const { data, error } = await client.from("campaign_votes").select("*").eq("id", id).single();
    return error ? null : voteRow(data);
  } catch { console.error("[campaign] receipt lookup failed"); return null; }
}
export async function reserveCopy(id: string, quantity: number): Promise<{ status: string; quantity?: number }> {
  const client = db();
  if (!client) return { status: "unavailable" };
  try {
    const { data, error } = await client.rpc("reserve_campaign_copy", { p_vote_id: id, p_quantity: quantity });
    const row = record(data);
    return !error && row && (row.status === "saved" || row.status === "existing") && typeof row.quantity === "number"
      ? { status: row.status, quantity: row.quantity } : { status: "unavailable" };
  } catch { console.error("[campaign] reservation save failed"); return { status: "unavailable" }; }
}
export async function campaignKitUrl(): Promise<string | null> {
  if (!storageClient) return null;
  try {
    const { data, error } = await storageClient.storage.from(CAMPAIGN_BUCKET)
      .createSignedUrl(CAMPAIGN_KIT_PATH, KIT_URL_SECONDS, { download: "Neighborhood-Chronicles-Starter-Kit.pdf" });
    if (error || typeof data?.signedUrl !== "string" || new URL(data.signedUrl).protocol !== "https:") return null;
    return data.signedUrl;
  } catch { console.error("[campaign] kit signing failed"); return null; }
}
export interface CampaignSummary {
  votes: number; reservations: number; pendingEmails: number; failedEmails: number;
  groups: { character: Character; source: string; votes: number }[];
}
export async function campaignAdminData(cursor?: string): Promise<{ rows: CampaignVote[]; summary: CampaignSummary } | null> {
  const client = db();
  if (!client) return null;
  try {
    let query = client.from("campaign_votes").select("*").order("created_at", { ascending: false })
      .order("id", { ascending: false }).limit(CAMPAIGN_PAGE_SIZE);
    const before = parsePageCursor(cursor);
    if (before) query = query.or(`created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt.${before.id})`);
    const [list, totals] = await Promise.all([query, client.rpc("campaign_summary")]);
    const summary = record(totals.data);
    if (list.error || totals.error || !summary || !Array.isArray(list.data) || !Array.isArray(summary.groups)
      || ![summary.votes, summary.reservations, summary.pendingEmails, summary.failedEmails].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
    const rows = list.data.map(voteRow);
    if (rows.some((row) => row === null)) return null;
    return { rows: rows as CampaignVote[], summary: summary as unknown as CampaignSummary };
  } catch { console.error("[campaign] admin read failed"); return null; }
}
export interface CampaignJob {
  id: string; voteId: string; lease: string; kind: "welcome" | "reservation"; attempts: number;
  createdAt: string; firstName: string; email: string; character: Character; quantity: number | null;
}
export async function claimCampaignJobs(voteId?: string): Promise<CampaignJob[] | null> {
  const client = db();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc("claim_campaign_messages", { p_vote_id: voteId ?? null, p_limit: voteId ? 2 : 3 });
    if (error || !Array.isArray(data)) return null;
    if (data.some((raw: unknown) => {
      const r = record(raw);
      return !r || !isCharacter(r.character) || ![r.id, r.voteId, r.lease].every((s) => typeof s === "string" && UUID_PATTERN.test(s))
        || (r.kind !== "welcome" && r.kind !== "reservation") || typeof r.email !== "string"
        || typeof r.firstName !== "string" || typeof r.createdAt !== "string";
    })) return null;
    return data as CampaignJob[];
  } catch { console.error("[campaign] outbox claim failed"); return null; }
}
export async function finishCampaignJob(job: CampaignJob, sent: boolean, reason: string | null): Promise<boolean> {
  const client = db();
  if (!client) return false;
  try {
    const { data, error } = await client.rpc("finish_campaign_message", {
      p_id: job.id, p_lease: job.lease, p_sent: sent, p_failure: reason,
    });
    return !error && data === true;
  } catch { console.error("[campaign] outbox acknowledgement failed"); return false; }
}
