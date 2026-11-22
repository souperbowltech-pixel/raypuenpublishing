import { NextRequest } from "next/server";
import { campaignJson } from "@/lib/campaign-http";
import { deliverCampaignMessages, workerAuthorized, workerConfigured } from "@/lib/campaign-delivery";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  if (!workerConfigured()) return campaignJson({ error: "Worker unavailable." }, 503);
  if (!workerAuthorized(req.headers.get("authorization"))) return campaignJson({ error: "Unauthorized." }, 401);
  const result = await deliverCampaignMessages();
  return campaignJson(result, result.ok ? 200 : 503);
}
