import { NextRequest, NextResponse } from "next/server";
import { campaignAdminGate, campaignCsv } from "@/lib/campaign-admin";
import { campaignAdminData, retryCampaignMessages } from "@/lib/campaign-store";
import { campaignJson, readCampaignJson, CAMPAIGN_HEADERS } from "@/lib/campaign-http";
import { UUID_PATTERN } from "@/lib/campaign";
import { deliverCampaignMessages } from "@/lib/campaign-delivery";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const gate = await campaignAdminGate(req); if (gate) return gate;
  const data = await campaignAdminData(req.nextUrl.searchParams.get("before") ?? undefined);
  if (!data) return campaignJson({ error: "Campaign records could not be loaded." }, 503);
  if (req.nextUrl.searchParams.get("format") === "csv") return new NextResponse(campaignCsv(data.rows), {
    headers: { ...CAMPAIGN_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="campaign-votes-page.csv"' },
  });
  return campaignJson(data);
}
export async function POST(req: NextRequest) {
  const gate = await campaignAdminGate(req); if (gate) return gate;
  const parsed = await readCampaignJson(req); if (!parsed.ok) return parsed.response;
  if (typeof parsed.body.voteId !== "string" || !UUID_PATTERN.test(parsed.body.voteId)) return campaignJson({ error: "Invalid record." }, 400);
  const reset = await retryCampaignMessages(parsed.body.voteId);
  if (reset !== "reset") return campaignJson({ error: reset === "busy" ? "Nothing is ready for retry; it may already be sent or currently sending." : "Retry could not be saved." }, reset === "busy" ? 409 : 503);
  const result = await deliverCampaignMessages(parsed.body.voteId);
  return campaignJson({ message: result.accepted ? "Message accepted by the email provider." : "Retry recorded. Delivery is still pending.", ...result });
}
