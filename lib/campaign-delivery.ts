import { createHash, timingSafeEqual } from "node:crypto";
import { claimCampaignJobs, finishCampaignJob } from "@/lib/campaign-store";
import { makeReceipt, verifyReceipt } from "@/lib/campaign-token";
import { CHARACTER_NAMES } from "@/lib/campaign";
import { CHARACTER_MESSAGES, thankYouTitle } from "@/lib/campaign-content";
import { sendEmail } from "@/lib/email";
import { approvalRecipient } from "@/lib/notifications";
import { getSiteOrigin } from "@/lib/site";

export function workerConfigured(): boolean { return (process.env.CRON_SECRET?.length ?? 0) >= 32; }
export function workerAuthorized(header: string | null): boolean {
  if (!workerConfigured() || !header) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(header), hash(`Bearer ${process.env.CRON_SECRET}`));
}
/** Every message retains one provider key across worker crashes and retries. */
export async function deliverCampaignMessages(voteId?: string): Promise<{ ok: boolean; accepted: number; pending: number }> {
  const jobs = await claimCampaignJobs(voteId);
  if (!jobs) return { ok: false, accepted: 0, pending: 0 };
  let accepted = 0;
  let pending = 0;
  for (const job of jobs) {
    let sent = false;
    let failure = "error";
    try {
      const receipt = job.kind === "welcome" ? makeReceipt(job.voteId, job.createdAt) : null;
      if (job.kind === "welcome" && (!receipt || !verifyReceipt(receipt))) {
        failure = receipt ? "expired" : "not-configured";
      } else {
        const link = `${getSiteOrigin()}/welcome/download#receipt=${encodeURIComponent(receipt ?? "")}`;
        const reservationLink = `${getSiteOrigin()}/welcome/thanks#receipt=${encodeURIComponent(receipt ?? "")}`;
        const message = job.kind === "welcome" ? {
          to: job.email,
          subject: `A special note for your family from Sunny & ${CHARACTER_NAMES[job.character]}!`,
          text: [
            thankYouTitle(job.firstName, job.character), "", CHARACTER_MESSAGES[job.character], "",
            "Your family can open the free Starter Kit using this private link:", link, "",
            "The link is valid for 30 days from your request. Keep it private.",
            "No purchase is needed. This email delivers the kit you requested.", "", "Puen Publishing",
            `See Book 1 and reserve or order your copy: ${reservationLink}`,
          ].join("\n"),
        } : {
          to: approvalRecipient(), subject: "Neighborhood Chronicles: copy reservation",
          text: ["A parent reserved a copy of The Neighborhood Chronicles, Book 1.", "",
            `Parent: ${job.firstName}`, `Email: ${job.email}`, `Copies: ${job.quantity}`,
            "This is an expression of interest, not a paid order. No delivery date was promised.",
            "The reservation is also saved on the campaign admin page.",
          ].join("\n"),
        };
        const result = await sendEmail({ ...message, fromName: "Puen Publishing", idempotencyKey: `campaign/${job.id}` });
        sent = result.sent;
        if (!result.sent) failure = result.reason;
      }
    } catch { console.error("[campaign] delivery attempt failed"); }
    const acknowledged = await finishCampaignJob(job, sent, sent ? null : failure);
    if (sent && acknowledged) accepted += 1;
    else pending += 1;
  }
  return { ok: true, accepted, pending };
}
