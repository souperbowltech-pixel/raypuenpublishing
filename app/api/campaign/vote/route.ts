import { NextRequest } from "next/server";
import { validateVote } from "@/lib/campaign";
import { campaignReady, saveVote } from "@/lib/campaign-store";
import { campaignJson, readCampaignJson, campaignLimit } from "@/lib/campaign-http";
import { deliverCampaignMessages } from "@/lib/campaign-delivery";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const parsed = await readCampaignJson(req);
  if (!parsed.ok) return parsed.response;
  if (parsed.body.website) return campaignJson({ error: "Please check the form." }, 400);
  const input = validateVote(parsed.body);
  if (!input.ok) return campaignJson({ error: input.error, field: input.field }, 400);
  const limited = await campaignLimit(req, "vote", input.value.submissionId);
  if (limited) return limited;
  if (!await campaignReady()) return campaignJson({ error: "The Starter Kit is temporarily unavailable. Please try again soon." }, 503);
  const saved = await saveVote(input.value);
  if (saved.status === "unavailable") return campaignJson({ error: "We could not save your request. Please try again." }, 503);
  if (saved.status === "conflict") return campaignJson({ error: "This request changed. Reload the page to start a new request." }, 409);
  if (saved.status !== "saved" && saved.status !== "replay") return campaignJson({ message: "If you requested this kit before, please use the private link in that email. Contact Puen Publishing if you need help." });
  await deliverCampaignMessages(saved.id);
  return campaignJson({ receipt: saved.receipt });
}
