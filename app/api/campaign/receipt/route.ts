import { NextRequest } from "next/server";
import { campaignJson, readCampaignJson, campaignLimit, receiptVote } from "@/lib/campaign-http";
import { CHARACTER_NAMES, seasonalReservationTitle } from "@/lib/campaign";
import { CHARACTER_MESSAGES, thankYouTitle } from "@/lib/campaign-content";
import { isStripeTestMode } from "@/lib/stripe";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const parsed = await readCampaignJson(req);
  if (!parsed.ok) return parsed.response;
  const limited = await campaignLimit(req, "receipt"); if (limited) return limited;
  const vote = await receiptVote(parsed.body.receipt);
  if (!vote) return campaignJson({ error: "We could not open this private link. It may have expired, or the service may be temporarily unavailable." }, 404);
  return campaignJson({ firstName: vote.firstName, character: CHARACTER_NAMES[vote.character],
    title: thankYouTitle(vote.firstName, vote.character), message: CHARACTER_MESSAGES[vote.character],
    quantity: vote.quantity, canOrder: !isStripeTestMode(), reservationTitle: seasonalReservationTitle() });
}
