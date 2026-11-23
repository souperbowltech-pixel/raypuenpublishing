import { NextRequest } from "next/server";
import { campaignJson, readCampaignJson, campaignLimit, receiptVote } from "@/lib/campaign-http";
import { reservationQuantity } from "@/lib/campaign";
import { reserveCopy } from "@/lib/campaign-store";
import { deliverCampaignMessages } from "@/lib/campaign-delivery";
import { isStripeTestMode } from "@/lib/stripe";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const parsed = await readCampaignJson(req); if (!parsed.ok) return parsed.response;
  const limited = await campaignLimit(req, "reserve", parsed.body.receipt); if (limited) return limited;
  if (!isStripeTestMode()) return campaignJson({ error: "Ordering is open. Please use the book order page.", orderPath: "/neighborhood#order" }, 409);
  const quantity = reservationQuantity(parsed.body.quantity);
  if (quantity === null) return campaignJson({ error: "Choose between 1 and 10 copies." }, 400);
  const vote = await receiptVote(parsed.body.receipt);
  if (!vote) return campaignJson({ error: "This private link could not be opened. Please check it and try again." }, 404);
  const saved = await reserveCopy(vote.id, quantity);
  if (saved.status === "unavailable") return campaignJson({ error: "Your reservation could not be saved. Please try again." }, 503);
  await deliverCampaignMessages(vote.id);
  return campaignJson({ quantity: saved.quantity, message: "Your interest is saved. This is not a payment or a confirmed delivery date." });
}
