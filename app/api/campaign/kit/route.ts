import { NextRequest } from "next/server";
import { campaignJson, readCampaignJson, campaignLimit, receiptVote } from "@/lib/campaign-http";
import { campaignReady, campaignKitUrl } from "@/lib/campaign-store";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const parsed = await readCampaignJson(req); if (!parsed.ok) return parsed.response;
  const limited = await campaignLimit(req, "kit"); if (limited) return limited;
  if (!await receiptVote(parsed.body.receipt)) return campaignJson({ error: "This private link could not be opened. Please check it and try again." }, 404);
  if (!await campaignReady()) return campaignJson({ error: "The kit is temporarily unavailable. Your request is still saved. Please try again later." }, 503);
  const url = await campaignKitUrl();
  return url ? campaignJson({ url }) : campaignJson({ error: "The kit could not be opened. Please try again later." }, 503);
}
