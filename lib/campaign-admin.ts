import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminConfigured, isAdminCookie } from "@/lib/admin-auth";
import { campaignJson, campaignLimit } from "@/lib/campaign-http";
import { csvCell, CHARACTER_NAMES } from "@/lib/campaign";
import type { CampaignVote } from "@/lib/campaign-store";

export function campaignAdminSignedIn(cookie: string | undefined): boolean {
  return adminConfigured() && isAdminCookie(cookie);
}
export async function campaignAdminGate(req: NextRequest) {
  if (!campaignAdminSignedIn(req.cookies.get(ADMIN_COOKIE)?.value)) return campaignJson({ error: "Please sign in to admin." }, 401);
  return campaignLimit(req, "admin");
}
export function deliveryLabel(row: CampaignVote, kind: "welcome" | "reservation"): string {
  const job = row.deliveries.find((d) => d.kind === kind);
  if (!job) return "Not requested";
  if (job.sent) return "Accepted by email provider";
  if (job.busy) return "Sending";
  return job.attempts >= 5 ? `Needs attention: ${job.failure ?? "delivery failed"}` : `Queued${job.failure ? `: ${job.failure}` : ""}`;
}
export function campaignCsv(rows: CampaignVote[]): string {
  const columns = ["Parent", "Email", "Character", "Source", "Answer", "Phone", "Text permission", "Email updates permission", "Reserved copies", "Received (UTC)", "Kit email", "Owner notice"];
  const lines = rows.map((r) => [r.firstName, r.email, CHARACTER_NAMES[r.character], r.source, r.answer, r.phone,
    r.smsConsent ? "yes" : "no", r.marketingConsent ? "yes" : "no", r.quantity, r.createdAt,
    deliveryLabel(r, "welcome"), deliveryLabel(r, "reservation")]);
  return "\ufeff" + [columns, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}
