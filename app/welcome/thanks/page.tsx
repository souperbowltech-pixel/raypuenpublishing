import type { Metadata } from "next";
import { CampaignReceipt } from "@/components/campaign/CampaignReceipt";
export const metadata: Metadata = { title: "Your Starter Kit | Puen Publishing", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function CampaignThanksPage() {
  return <main className="min-h-screen bg-paper px-4 py-12"><CampaignReceipt /></main>;
}
