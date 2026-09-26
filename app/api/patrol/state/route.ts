import { NextRequest, NextResponse } from "next/server";
import { getPatrolLeaderByToken } from "@/lib/patrol-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = rateLimit(`patrol-state:${clientIp(req)}`, 30, 60_000);
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

  return NextResponse.json({ success: true, ...details });
}
