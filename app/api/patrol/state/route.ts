import { NextRequest, NextResponse } from "next/server";
import { getPatrolLeaderByToken } from "@/lib/patrol-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = await rateLimit(`patrol-state:${clientIp(req)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const details = await getPatrolLeaderByToken(token);
  if (!details) {
    return NextResponse.json({ error: "Patrol Leader not found" }, { status: 404 });
  }

  // Public fields are opt-in so new store fields cannot expose credentials.
  return NextResponse.json({
    success: true,
    leader: {
      email: details.leader.email,
      giftsRedeemedCount: details.leader.giftsRedeemedCount,
      status: details.leader.status,
    },
    gifts: details.gifts.map((gift) => ({
      code: gift.code,
      slotNumber: gift.slotNumber,
      redeemedAt: gift.redeemedAt,
    })),
    approval: details.approval ? {
      status: details.approval.status,
      recipientName: details.approval.recipientName,
    } : undefined,
  });
}
