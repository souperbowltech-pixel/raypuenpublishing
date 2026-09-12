import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateScoutAsync } from '@/lib/scout-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || 'CAPTAIN-RAY-700';
  const name = searchParams.get('name') || undefined;

  const scout = await getOrCreateScoutAsync(token, name);
  return NextResponse.json({ success: true, scout });
}
