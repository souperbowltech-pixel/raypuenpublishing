import { NextRequest, NextResponse } from "next/server";
import { updateScout } from "@/lib/scout-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, ...updates } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const scout = updateScout(token, updates);
    return NextResponse.json({ success: true, scout });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update scout state" },
      { status: 500 }
    );
  }
}
