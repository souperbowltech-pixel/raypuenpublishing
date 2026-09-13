import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    clientInitialized: !!supabase,
    supabaseQuerySuccess: false,
    supabaseError: null as any,
    scoutData: null as any,
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('scout_profiles')
        .select('*')
        .eq('token', 'CAPTAIN-RAY-700')
        .maybeSingle();

      if (error) {
        status.supabaseError = error.message;
      } else {
        status.supabaseQuerySuccess = true;
        status.scoutData = data;
      }
    } catch (e: any) {
      status.supabaseError = e?.message || String(e);
    }
  }

  return NextResponse.json(status);
}
