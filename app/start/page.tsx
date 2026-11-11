import { BonusVideo } from "@/components/start/BonusVideo";
import { getVideo } from "@/lib/videos";
import { StartForm } from "./StartForm";

/**
 * puenpublishing.com/start, printed as the last code in the book. The Bonus
 * Video plays here once its row in public.videos is live, and force-dynamic
 * keeps that one table edit away from going live, with no deploy.
 *
 * Signing up is this page's real job, so the video lookup gets a short deadline
 * (loading.tsx shows meanwhile) and a slow database just means no video.
 */
export const dynamic = "force-dynamic";

const BONUS_TIMEOUT_MS = 1_500;

export default async function StartPage() {
  const view = await getVideo("bonus", BONUS_TIMEOUT_MS);
  const bonus = view.state === "live" ? <BonusVideo view={view} /> : undefined;
  return <StartForm bonus={bonus} />;
}
