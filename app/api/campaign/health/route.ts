import { campaignJson } from "@/lib/campaign-http";
import { campaignReady } from "@/lib/campaign-store";
import { workerConfigured } from "@/lib/campaign-delivery";
import { emailConfigured } from "@/lib/email";
export const dynamic = "force-dynamic";
export async function GET() {
  const checks = { campaign: await campaignReady(), email: emailConfigured(), worker: workerConfigured() };
  const ok = Object.values(checks).every(Boolean);
  return campaignJson({ ok, checks }, ok ? 200 : 503);
}
