import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rrssxdmsfvrzpixgoiuo.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const report: Record<string, any> = {
    url,
    anonKeyLength: anonKey.length,
    anonKeyPreview: anonKey ? `${anonKey.slice(0, 12)}...${anonKey.slice(-6)}` : 'missing',
    serviceKeyLength: serviceKey.length,
    serviceKeyPreview: serviceKey ? `${serviceKey.slice(0, 12)}...${serviceKey.slice(-6)}` : 'missing',
    anonTest: null,
    serviceTest: null,
  };

  // Test with Anon Key
  if (anonKey) {
    try {
      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data, error } = await client.from('scout_profiles').select('*').limit(1);
      report.anonTest = error ? `Error: ${error.message}` : `Success (${data?.length || 0} rows)`;
    } catch (e: any) {
      report.anonTest = `Exception: ${e.message}`;
    }
  }

  // Test with Service Key
  if (serviceKey) {
    try {
      const client = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await client.from('scout_profiles').select('*').limit(1);
      report.serviceTest = error ? `Error: ${error.message}` : `Success (${data?.length || 0} rows)`;
    } catch (e: any) {
      report.serviceTest = `Exception: ${e.message}`;
    }
  }

  return NextResponse.json(report);
}
